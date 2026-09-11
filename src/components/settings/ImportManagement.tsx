import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

type ImportKind = 'customers' | 'equipment' | 'sales_history';
type CsvRow = Record<string, string>;
type ValidationRow = { row_number: number; raw_data: CsvRow; validation_errors: string[]; status: 'valid' | 'invalid' };
type Batch = { id: string; kind: ImportKind; status: string; file_name: string; total_rows: number; valid_rows: number; invalid_rows: number; imported_rows: number; created_at: string };

const definitions: Record<ImportKind, { label: string; headers: string[]; sample: string[]; help: string }> = {
  customers: {
    label: 'Clientes',
    headers: ['nome', 'tipo_pessoa', 'cpf_cnpj', 'telefone', 'email', 'razao_social', 'nome_fantasia', 'observacoes', 'rg', 'data_nascimento', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado'],
    sample: ['Cliente Exemplo', 'PF', '12345678901', '11999999999', 'cliente@exemplo.com', '', '', 'Importação inicial', '12345678X', '15/01/1990', '01310-100', 'Avenida Paulista', '1000', 'Apto 101', 'Bela Vista', 'São Paulo', 'SP'],
    help: 'Nome e telefone com DDD são obrigatórios. RG, nascimento e endereço são opcionais. Use DD/MM/AAAA ou AAAA-MM-DD para nascimento e a sigla da UF para estado.',
  },
  equipment: {
    label: 'Equipamentos',
    headers: ['tipo', 'codigo', 'capacidade_litros', 'status', 'voltagem', 'observacoes'],
    sample: ['barril', 'BAR-001', '50', 'cheio_loja', '', 'Patrimônio inicial'],
    help: 'Tipos aceitos: barril, chopeira e cilindro. Cada item deve ter código único.',
  },
  sales_history: {
    label: 'Vendas históricas',
    headers: ['numero', 'data', 'cliente', 'cpf_cnpj', 'descricao', 'total', 'forma_pagamento', 'observacoes'],
    sample: ['LEG-001', '31/08/2026', 'Cliente Exemplo', '12345678901', 'Venda importada', '350,00', 'pix', 'Sistema anterior'],
    help: 'Entram como histórico fechado e não alteram o estoque atual.',
  },
};

function csvEscape(value: string) {
  return /[";,\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadTemplate(kind: ImportKind) {
  const definition = definitions[kind];
  const content = `\uFEFF${definition.headers.map(csvEscape).join(';')}\r\n${definition.sample.map(csvEscape).join(';')}\r\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `modelo-${kind}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(source: string): CsvRow[] {
  const delimiter = (source.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) >= (source.split(/\r?\n/, 1)[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const records: string[][] = [];
  let record: string[] = [], field = '', quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { record.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      record.push(field.trim()); field = '';
      if (record.some(Boolean)) records.push(record);
      record = [];
    } else field += char;
  }
  record.push(field.trim());
  if (record.some(Boolean)) records.push(record);
  if (quoted) throw new Error('Há aspas abertas no arquivo CSV.');
  const headers = (records.shift() ?? []).map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase());
  if (!headers.length) throw new Error('O arquivo está vazio.');
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('onboarding-imports', { body });
  if (error) throw new Error((data as { error?: string } | null)?.error || error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export function ImportManagement() {
  const { organization } = useTenant();
  const [kind, setKind] = useState<ImportKind>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [validation, setValidation] = useState<{ batch_id: string; total_rows: number; valid_rows: number; invalid_rows: number; rows: ValidationRow[] } | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [busy, setBusy] = useState(false);
  const definition = definitions[kind];
  const missingHeaders = useMemo(() => rows.length ? (kind === 'customers' ? ['nome', 'telefone'] : definition.headers).filter((header) => !(header in rows[0])) : [], [kind, definition.headers, rows]);

  const loadBatches = async () => {
    if (!organization) return;
    try {
      const data = await invoke({ action: 'list', organization_id: organization.id });
      setBatches(data.batches ?? []);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao carregar lotes.'); }
  };
  useEffect(() => { void loadBatches(); }, [organization?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectFile = async (selected: File | null) => {
    setFile(selected); setRows([]); setValidation(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.csv')) { toast.error('Use um arquivo CSV salvo em UTF-8.'); return; }
    try { setRows(parseCsv(await selected.text())); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'CSV inválido.'); }
  };

  const validate = async () => {
    if (!organization || !file || !rows.length || missingHeaders.length) return;
    setBusy(true);
    try {
      const data = await invoke({ action: 'validate', organization_id: organization.id, kind, file_name: file.name, rows });
      setValidation(data);
      toast.success(data.invalid_rows ? 'Validação concluída com pendências.' : 'Arquivo pronto para importar.');
      await loadBatches();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro na validação.'); }
    finally { setBusy(false); }
  };

  const commit = async () => {
    if (!organization || !validation || validation.invalid_rows) return;
    setBusy(true);
    try {
      const data = await invoke({ action: 'commit', organization_id: organization.id, batch_id: validation.batch_id });
      toast.success(`${data.imported_rows} registros importados com sucesso.`);
      setFile(null); setRows([]); setValidation(null); await loadBatches();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao confirmar importação.'); }
    finally { setBusy(false); }
  };

  return <div className="space-y-4">
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Importação controlada</AlertTitle>
      <AlertDescription>Faça uma cópia dos dados de origem. O arquivo é validado antes da gravação e somente administradores podem confirmar.</AlertDescription>
    </Alert>
    <Card>
      <CardHeader><CardTitle>Nova importação</CardTitle><CardDescription>Baixe o modelo, preencha sem alterar os cabeçalhos e envie o CSV.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Conteúdo</Label><Select value={kind} onValueChange={(value) => { setKind(value as ImportKind); setFile(null); setRows([]); setValidation(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(definitions).map(([key, value]) => <SelectItem key={key} value={key}>{value.label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{definition.help}</p></div>
          <div className="space-y-2"><Label>Modelo oficial</Label><Button variant="outline" className="w-full" onClick={() => downloadTemplate(kind)}><Download className="mr-2 h-4 w-4" />Baixar modelo CSV</Button><p className="text-xs text-muted-foreground">Abra no Excel e salve como CSV UTF-8.</p></div>
        </div>
        <div className="space-y-2"><Label htmlFor="import-file">Arquivo preenchido</Label><Input id="import-file" type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0] ?? null)} /></div>
        {rows.length > 0 && <div className="rounded-lg border p-3 text-sm"><FileSpreadsheet className="mr-2 inline h-4 w-4" /><strong>{rows.length}</strong> linhas encontradas.{missingHeaders.length > 0 && <p className="mt-2 text-destructive">Cabeçalhos ausentes: {missingHeaders.join(', ')}</p>}</div>}
        <Button onClick={validate} disabled={busy || !rows.length || missingHeaders.length > 0}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Validar arquivo</Button>
        {validation && <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap gap-2"><Badge variant="outline">{validation.total_rows} linhas</Badge><Badge className="bg-emerald-600">{validation.valid_rows} válidas</Badge>{validation.invalid_rows > 0 && <Badge variant="destructive">{validation.invalid_rows} com erro</Badge>}</div>
          {validation.rows.filter((row) => row.status === 'invalid').slice(0, 10).map((row) => <p key={row.row_number} className="text-sm text-destructive">Linha {row.row_number}: {row.validation_errors.join(' ')}</p>)}
          {validation.invalid_rows === 0 ? <Button onClick={commit} disabled={busy}><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar importação</Button> : <p className="text-sm text-muted-foreground">Corrija o arquivo e envie novamente. Nenhum registro foi gravado nos cadastros.</p>}
        </div>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Histórico de lotes</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Arquivo</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Registros</TableHead><TableHead>Data</TableHead></TableRow></TableHeader><TableBody>{batches.map((batch) => <TableRow key={batch.id}><TableCell>{batch.file_name}</TableCell><TableCell>{definitions[batch.kind].label}</TableCell><TableCell><Badge variant={batch.status === 'completed' ? 'default' : 'outline'}>{batch.status === 'completed' ? 'Concluído' : 'Validado'}</Badge></TableCell><TableCell>{batch.imported_rows || batch.valid_rows}/{batch.total_rows}</TableCell><TableCell>{new Date(batch.created_at).toLocaleString('pt-BR')}</TableCell></TableRow>)}</TableBody></Table>{!batches.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lote enviado.</p>}</CardContent></Card>
  </div>;
}
