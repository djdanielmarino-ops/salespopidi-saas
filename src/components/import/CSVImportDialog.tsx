import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { sanitizeDbError } from '@/lib/errorSanitizer';
import { customerRowForInsert, decodeCsv, normalizeCustomerRow, parseCsv } from '@/lib/csvImport';

type ImportType = 'customers' | 'cylinders' | 'taps' | 'beer_types';

const MAX_ROWS = 1000;

const importTypes: { value: ImportType; label: string }[] = [
  { value: 'customers', label: 'Clientes' },
  { value: 'cylinders', label: 'Cilindros' },
  { value: 'taps', label: 'Chopeiras' },
  { value: 'beer_types', label: 'Tipos de Chopp' },
];

const csvTemplates: Record<ImportType, { headers: string; example: string }> = {
  customers: {
    headers: 'full_name,phone,email,cpf,rg,birth_date,zip_code,street,number,complement,neighborhood,city,state',
    example: 'João Silva,(11)99999-9999,joao@email.com,123.456.789-00,12.345.678-9,1990-01-15,01310-100,Av Paulista,1000,Apto 101,Bela Vista,São Paulo,SP',
  },
  cylinders: {
    headers: 'code,status,notes',
    example: 'CIL001,cheio,Cilindro de CO2',
  },
  taps: {
    headers: 'code,voltage,status,notes',
    example: 'CHOP001,110V,disponivel,Chopeira elétrica',
  },
  beer_types: {
    headers: 'name,description,price_per_liter,cost_per_liter',
    example: 'Pilsen,Cerveja leve e refrescante,15.00,8.00',
  },
};

// Zod schemas for each import type
const customerSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório').max(255),
  phone: z.string().max(30),
  email: z.string().email('Email inválido').max(255).optional().or(z.literal('')),
  cpf: z.string().max(20).optional().or(z.literal('')),
  rg: z.string().max(20).optional().or(z.literal('')),
  birth_date: z.string().max(20).optional().or(z.literal('')),
  zip_code: z.string().max(15).optional().or(z.literal('')),
  street: z.string().max(255).optional().or(z.literal('')),
  number: z.string().max(20).optional().or(z.literal('')),
  complement: z.string().max(255).optional().or(z.literal('')),
  neighborhood: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(255).optional().or(z.literal('')),
  state: z.string().max(5).optional().or(z.literal('')),
});

const cylinderSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(50),
  status: z.enum(['cheio', 'com_cliente', 'vazio']).optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const tapSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').max(50),
  voltage: z.string().max(10).optional().or(z.literal('')),
  status: z.enum(['disponivel', 'em_uso', 'manutencao']).optional(),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const beerTypeSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(255),
  description: z.string().max(500).optional().or(z.literal('')),
  price_per_liter: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Preço inválido').optional().or(z.literal('')),
  cost_per_liter: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Custo inválido').optional().or(z.literal('')),
});

const schemas: Record<ImportType, z.ZodSchema> = {
  customers: customerSchema,
  cylinders: cylinderSchema,
  taps: tapSchema,
  beer_types: beerTypeSchema,
};

export function CSVImportDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [importType, setImportType] = useState<ImportType>('customers');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const template = csvTemplates[importType];
    const content = `${template.headers}\n${template.example}`;
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `template_${importType}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    
    try {
      const text = decodeCsv(await file.arrayBuffer());
      const parsedRows = parseCsv(text);
      const rows = importType === 'customers' ? parsedRows.map(normalizeCustomerRow) : parsedRows;
      
      if (rows.length === 0) {
        toast.error('Arquivo CSV vazio ou inválido');
        return;
      }

      if (rows.length > MAX_ROWS) {
        toast.error(`O arquivo excede o limite de ${MAX_ROWS} linhas. Reduza o arquivo e tente novamente.`);
        return;
      }

      const schema = schemas[importType];
      
      // Validate all rows first
      const validationErrors: string[] = [];
      const validRows: Record<string, string>[] = [];

      for (let i = 0; i < rows.length; i++) {
        const result = schema.safeParse(rows[i]);
        if (!result.success) {
          validationErrors.push(`Linha ${i + 2}: ${result.error.issues[0].message}`);
        } else {
          validRows.push(rows[i]);
        }
      }

      if (validationErrors.length > 0 && validRows.length === 0) {
        toast.error(`Nenhuma linha válida. ${validationErrors[0]}`);
        return;
      }

      if (validationErrors.length > 0) {
        toast.warning(`${validationErrors.length} linhas com erros foram ignoradas.`);
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of validRows) {
        try {
          const dbRow = importType === 'customers' ? customerRowForInsert(row) : row;
          const { error } = await supabase.from(importType).insert([dbRow] as any);
          if (error) {
            console.error('Erro na importação:', sanitizeDbError(error));
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err) {
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: [importType] });
      
      if (errorCount === 0) {
        toast.success(`${successCount} registros importados com sucesso!`);
      } else {
        toast.warning(`${successCount} importados, ${errorCount} erros`);
      }
      
      setIsOpen(false);
    } catch (err) {
      toast.error('Erro ao processar arquivo CSV');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Dados via CSV</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Tipo de Dados</Label>
            <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {importTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">Instruções:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Baixe o template CSV abaixo</li>
              <li>Preencha com seus dados (mantenha os cabeçalhos)</li>
              <li>Salve o arquivo e faça upload (máx. {MAX_ROWS} linhas)</li>
            </ol>
          </div>

          <Button variant="outline" className="w-full" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Template CSV
          </Button>

          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Arraste o arquivo CSV ou clique para selecionar
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <Button 
              variant="secondary" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              {isImporting ? 'Importando...' : 'Selecionar Arquivo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
