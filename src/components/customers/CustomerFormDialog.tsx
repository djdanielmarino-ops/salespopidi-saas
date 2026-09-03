import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateCustomer, useUpdateCustomer, useCheckDuplicateCustomer, calculateAge } from '@/hooks/useCustomers';
import { Customer, PersonType } from '@/types/database';
import { Plus, Loader2, Building2, User } from 'lucide-react';
import { toast } from 'sonner';
import { fetchAddressByCep } from '@/lib/viacep';
import { fetchCompanyByCnpj } from '@/lib/brasilapi';
import { maskCPF, maskCNPJ, maskPhone, maskCEP, unmask, validateCPF, validateCNPJ } from '@/hooks/useInputMask';
import { Badge } from '@/components/ui/badge';

interface CustomerFormDialogProps {
  customer?: Customer | null;
  trigger?: React.ReactNode;
  onSuccess?: (customer: any) => void;
}

export function CustomerFormDialog({ customer, trigger, onSuccess }: CustomerFormDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [personType, setPersonType] = useState<PersonType>(customer?.person_type || 'PF');
  const [cpfValue, setCpfValue] = useState(customer?.cpf ? maskCPF(customer.cpf) : '');
  const [cnpjValue, setCnpjValue] = useState(customer?.cnpj ? maskCNPJ(customer.cnpj) : '');
  const [phoneValue, setPhoneValue] = useState(customer?.phone ? maskPhone(customer.phone) : '');
  const [contactPhoneValue, setContactPhoneValue] = useState(customer?.contact_phone ? maskPhone(customer.contact_phone) : '');
  const [cepValue, setCepValue] = useState(customer?.zip_code ? maskCEP(customer.zip_code) : '');
  const formRef = useRef<HTMLFormElement>(null);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const checkDuplicate = useCheckDuplicateCustomer();

  useEffect(() => {
    if (customer) {
      setPersonType(customer.person_type || 'PF');
      setCpfValue(customer.cpf ? maskCPF(customer.cpf) : '');
      setCnpjValue(customer.cnpj ? maskCNPJ(customer.cnpj) : '');
      setPhoneValue(customer.phone ? maskPhone(customer.phone) : '');
      setContactPhoneValue(customer.contact_phone ? maskPhone(customer.contact_phone) : '');
      setCepValue(customer.zip_code ? maskCEP(customer.zip_code) : '');
    } else {
      setPersonType('PF');
      setCpfValue('');
      setCnpjValue('');
      setPhoneValue('');
      setContactPhoneValue('');
      setCepValue('');
    }
    setFieldErrors({});
  }, [customer, isOpen]);

  const handlePersonTypeChange = (type: PersonType) => {
    setPersonType(type);
    setFieldErrors({});
    if (type === 'PF') {
      setCnpjValue('');
      setContactPhoneValue('');
    } else {
      setCpfValue('');
    }
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpjValue(maskCNPJ(e.target.value));
  };

  const handleCnpjBlur = async () => {
    const digits = unmask(cnpjValue);
    if (digits.length !== 14) return;
    if (!validateCNPJ(digits)) {
      setFieldErrors(prev => ({ ...prev, cnpj: 'CNPJ inválido' }));
      return;
    }
    setFieldErrors(prev => { const { cnpj, ...rest } = prev; return rest; });
    setIsLoadingCnpj(true);
    try {
      const company = await fetchCompanyByCnpj(digits);
      if (company && formRef.current) {
        const form = formRef.current;
        const setVal = (name: string, val: string | null) => {
          const el = form.elements.namedItem(name) as HTMLInputElement;
          if (el && val) {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        };
        setVal('company_name', company.razao_social);
        setVal('trade_name', company.nome_fantasia);
        setVal('full_name', company.razao_social);
        if (company.cep) setCepValue(maskCEP(company.cep));
        setVal('street', company.logradouro);
        setVal('number', company.numero);
        setVal('complement', company.complemento);
        setVal('neighborhood', company.bairro);
        setVal('city', company.municipio);
        setVal('state', company.uf);
        toast.success('Dados da empresa preenchidos automaticamente');
      }
    } catch {
      // silent
    } finally {
      setIsLoadingCnpj(false);
    }
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfValue(maskCPF(e.target.value));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneValue(maskPhone(e.target.value));
  };

  const handleContactPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactPhoneValue(maskPhone(e.target.value));
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCepValue(maskCEP(e.target.value));
  };

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length !== 8) return;
    setIsLoadingCep(true);
    try {
      const address = await fetchAddressByCep(cep);
      if (address && formRef.current) {
        const form = formRef.current;
        const setVal = (name: string, val: string) => {
          const el = form.elements.namedItem(name) as HTMLInputElement;
          if (el) el.value = val;
        };
        setVal('street', address.logradouro || '');
        setVal('neighborhood', address.bairro || '');
        setVal('city', address.localidade || '');
        setVal('state', address.uf || '');
        toast.success('Endereço preenchido automaticamente');
      } else if (cep.length === 8) {
        toast.error('CEP não encontrado');
      }
    } catch {
      console.error('Erro ao buscar CEP');
    } finally {
      setIsLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldErrors({});
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const phone = unmask(phoneValue);

    if (personType === 'PF') {
      const cpf = cpfValue ? unmask(cpfValue) : null;
      const rg = (formData.get('rg') as string)?.trim() || null;
      const email = (formData.get('email') as string)?.trim() || null;
      const birthDate = formData.get('birth_date') as string;

      if (cpf && !validateCPF(cpf)) {
        toast.error('CPF inválido');
        setFieldErrors({ cpf: 'CPF inválido' });
        setIsSubmitting(false);
        return;
      }

      if (birthDate) {
        const age = calculateAge(birthDate);
        if (age < 18) {
          toast.error('Cliente deve ter 18 anos ou mais para ser cadastrado');
          setFieldErrors({ birth_date: 'Cliente deve ter 18 anos ou mais' });
          setIsSubmitting(false);
          return;
        }
      }

      const duplicateError = await checkDuplicate(cpf, rg, email, phone, null, customer?.id);
      if (duplicateError) {
        toast.error(duplicateError.message);
        setFieldErrors({ [duplicateError.field]: duplicateError.message });
        setIsSubmitting(false);
        return;
      }

      const customerData = {
        person_type: 'PF' as PersonType,
        full_name: formData.get('full_name') as string,
        birth_date: birthDate || null,
        cpf,
        rg,
        email,
        phone,
        zip_code: cepValue ? unmask(cepValue) : null,
        street: formData.get('street') as string || null,
        number: formData.get('number') as string || null,
        complement: formData.get('complement') as string || null,
        neighborhood: formData.get('neighborhood') as string || null,
        city: formData.get('city') as string || null,
        state: formData.get('state') as string || null,
        notes: formData.get('notes') as string || null,
        cnpj: null,
        company_name: null,
        trade_name: null,
        state_registration: null,
        contact_name: null,
        contact_phone: null,
        contact_email: null,
      };

      try {
        let result;
        if (customer) {
          result = await updateCustomer.mutateAsync({ id: customer.id, ...customerData });
        } else {
          result = await createCustomer.mutateAsync(customerData);
        }
        setIsOpen(false);
        onSuccess?.(result);
      } catch { /* handled by mutation */ } finally {
        setIsSubmitting(false);
      }
    } else {
      // PJ
      const cnpj = cnpjValue ? unmask(cnpjValue) : null;
      if (!cnpj || !validateCNPJ(cnpj)) {
        toast.error('CNPJ inválido ou não preenchido');
        setFieldErrors({ cnpj: 'CNPJ obrigatório e válido' });
        setIsSubmitting(false);
        return;
      }

      const contactName = (formData.get('contact_name') as string)?.trim();
      if (!contactName) {
        toast.error('Nome do responsável é obrigatório para PJ');
        setFieldErrors({ contact_name: 'Obrigatório' });
        setIsSubmitting(false);
        return;
      }

      const duplicateError = await checkDuplicate(null, null, null, phone, cnpj, customer?.id);
      if (duplicateError) {
        toast.error(duplicateError.message);
        setFieldErrors({ [duplicateError.field]: duplicateError.message });
        setIsSubmitting(false);
        return;
      }

      const companyName = (formData.get('company_name') as string)?.trim() || '';

      const customerData = {
        person_type: 'PJ' as PersonType,
        full_name: companyName, // compatibility: full_name = razão social
        birth_date: null,
        cpf: null,
        rg: null,
        email: (formData.get('email') as string)?.trim() || null,
        phone,
        zip_code: cepValue ? unmask(cepValue) : null,
        street: formData.get('street') as string || null,
        number: formData.get('number') as string || null,
        complement: formData.get('complement') as string || null,
        neighborhood: formData.get('neighborhood') as string || null,
        city: formData.get('city') as string || null,
        state: formData.get('state') as string || null,
        notes: formData.get('notes') as string || null,
        cnpj,
        company_name: companyName,
        trade_name: (formData.get('trade_name') as string)?.trim() || null,
        state_registration: (formData.get('state_registration') as string)?.trim() || null,
        contact_name: contactName,
        contact_phone: contactPhoneValue ? unmask(contactPhoneValue) : null,
        contact_email: (formData.get('contact_email') as string)?.trim() || null,
      };

      try {
        let result;
        if (customer) {
          result = await updateCustomer.mutateAsync({ id: customer.id, ...customerData });
        } else {
          result = await createCustomer.mutateAsync(customerData);
        }
        setIsOpen(false);
        onSuccess?.(result);
      } catch { /* handled by mutation */ } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {customer ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* PF/PJ Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={personType === 'PF' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePersonTypeChange('PF')}
              className="flex-1"
            >
              <User className="mr-2 h-4 w-4" />
              Pessoa Física
            </Button>
            <Button
              type="button"
              variant={personType === 'PJ' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePersonTypeChange('PJ')}
              className="flex-1"
            >
              <Building2 className="mr-2 h-4 w-4" />
              Pessoa Jurídica
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {personType === 'PF' ? (
              <>
                <div className="md:col-span-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input id="full_name" name="full_name" required defaultValue={customer?.full_name} />
                </div>
                <div>
                  <Label htmlFor="birth_date">Data de Nascimento</Label>
                  <Input
                    id="birth_date" name="birth_date" type="date"
                    defaultValue={customer?.birth_date || ''}
                    className={fieldErrors.birth_date ? 'border-destructive' : ''}
                  />
                  {fieldErrors.birth_date && <p className="text-sm text-destructive mt-1">{fieldErrors.birth_date}</p>}
                </div>
                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone" name="phone" required placeholder="(11) 99999-9999"
                    value={phoneValue} onChange={handlePhoneChange}
                    className={fieldErrors.phone ? 'border-destructive' : ''}
                  />
                  {fieldErrors.phone && <p className="text-sm text-destructive mt-1">{fieldErrors.phone}</p>}
                </div>
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf" name="cpf" placeholder="000.000.000-00"
                    value={cpfValue} onChange={handleCpfChange}
                    className={fieldErrors.cpf ? 'border-destructive' : ''}
                  />
                  {fieldErrors.cpf && <p className="text-sm text-destructive mt-1">{fieldErrors.cpf}</p>}
                </div>
                <div>
                  <Label htmlFor="rg">RG</Label>
                  <Input id="rg" name="rg" defaultValue={customer?.rg || ''} className={fieldErrors.rg ? 'border-destructive' : ''} />
                  {fieldErrors.rg && <p className="text-sm text-destructive mt-1">{fieldErrors.rg}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email" name="email" type="email"
                    defaultValue={customer?.email || ''}
                    className={fieldErrors.email ? 'border-destructive' : ''}
                  />
                  {fieldErrors.email && <p className="text-sm text-destructive mt-1">{fieldErrors.email}</p>}
                </div>
              </>
            ) : (
              <>
                {/* PJ Fields */}
                <div className="md:col-span-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <div className="relative">
                    <Input
                      id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" required
                      value={cnpjValue} onChange={handleCnpjChange} onBlur={handleCnpjBlur}
                      className={fieldErrors.cnpj ? 'border-destructive' : ''}
                      disabled={isLoadingCnpj}
                    />
                    {isLoadingCnpj && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  {fieldErrors.cnpj && <p className="text-sm text-destructive mt-1">{fieldErrors.cnpj}</p>}
                </div>
                <div>
                  <Label htmlFor="company_name">Razão Social *</Label>
                  <Input id="company_name" name="company_name" required defaultValue={customer?.company_name || ''} />
                </div>
                <div>
                  <Label htmlFor="trade_name">Nome Fantasia</Label>
                  <Input id="trade_name" name="trade_name" defaultValue={customer?.trade_name || ''} />
                </div>
                <div>
                  <Label htmlFor="state_registration">Inscrição Estadual</Label>
                  <Input id="state_registration" name="state_registration" defaultValue={customer?.state_registration || ''} />
                </div>
                <div>
                  <Label htmlFor="email">E-mail da Empresa</Label>
                  <Input id="email" name="email" type="email" defaultValue={customer?.email || ''} />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone da Empresa *</Label>
                  <Input
                    id="phone" name="phone" required placeholder="(11) 99999-9999"
                    value={phoneValue} onChange={handlePhoneChange}
                    className={fieldErrors.phone ? 'border-destructive' : ''}
                  />
                  {fieldErrors.phone && <p className="text-sm text-destructive mt-1">{fieldErrors.phone}</p>}
                </div>
                {/* Hidden full_name for PJ */}
                <input type="hidden" name="full_name" value="" />

                {/* Contact section */}
                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Contato Principal</h3>
                </div>
                <div>
                  <Label htmlFor="contact_name">Nome do Responsável *</Label>
                  <Input
                    id="contact_name" name="contact_name" required
                    defaultValue={customer?.contact_name || ''}
                    className={fieldErrors.contact_name ? 'border-destructive' : ''}
                  />
                  {fieldErrors.contact_name && <p className="text-sm text-destructive mt-1">{fieldErrors.contact_name}</p>}
                </div>
                <div>
                  <Label htmlFor="contact_phone">Telefone do Responsável</Label>
                  <Input
                    id="contact_phone" name="contact_phone" placeholder="(11) 99999-9999"
                    value={contactPhoneValue} onChange={handleContactPhoneChange}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="contact_email">E-mail do Responsável</Label>
                  <Input id="contact_email" name="contact_email" type="email" defaultValue={customer?.contact_email || ''} />
                </div>
              </>
            )}

            {/* Address - shared */}
            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-foreground mb-3">Endereço</h3>
            </div>
            <div>
              <Label htmlFor="zip_code">CEP</Label>
              <div className="relative">
                <Input
                  id="zip_code" name="zip_code" placeholder="00000-000"
                  value={cepValue} onChange={handleCepChange} onBlur={handleCepBlur}
                  disabled={isLoadingCep}
                />
                {isLoadingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div>
              <Label htmlFor="street">Rua</Label>
              <Input id="street" name="street" defaultValue={customer?.street || ''} />
            </div>
            <div>
              <Label htmlFor="number">Número</Label>
              <Input id="number" name="number" defaultValue={customer?.number || ''} />
            </div>
            <div>
              <Label htmlFor="complement">Complemento</Label>
              <Input id="complement" name="complement" defaultValue={customer?.complement || ''} />
            </div>
            <div>
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input id="neighborhood" name="neighborhood" defaultValue={customer?.neighborhood || ''} />
            </div>
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" name="city" defaultValue={customer?.city || ''} />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input id="state" name="state" placeholder="SP" maxLength={2} defaultValue={customer?.state || ''} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Validando...' : customer ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
