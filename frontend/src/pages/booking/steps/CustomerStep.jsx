import { TextField } from '../../../components/index.js';
import { formatPhone } from '../../../lib/format.js';
import { validateEmail, validateName, validatePhone } from '../../../lib/validation.js';

const VALIDATORS = { name: validateName, phone: validatePhone, email: validateEmail };

/** Etapa 4: nome, WhatsApp (obrigatório) e e-mail (opcional). Valida ao sair do campo. */
export default function CustomerStep({ customer, errors, onChange, onErrors, onSubmit }) {
  const handleBlur = (field) => () => {
    onErrors({ [field]: VALIDATORS[field](customer[field]) });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit} noValidate>
      <TextField
        label="Nome"
        required
        autoComplete="name"
        value={customer.name}
        error={errors.name}
        onChange={(e) => onChange('name', e.target.value)}
        onBlur={handleBlur('name')}
      />
      <TextField
        label="WhatsApp"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        required
        placeholder="(11) 91234-5678"
        hint="Enviamos a confirmação e o lembrete por aqui."
        value={customer.phone}
        error={errors.phone}
        onChange={(e) => onChange('phone', formatPhone(e.target.value))}
        onBlur={handleBlur('phone')}
      />
      <TextField
        label="E-mail (opcional)"
        type="email"
        autoComplete="email"
        value={customer.email}
        error={errors.email}
        onChange={(e) => onChange('email', e.target.value)}
        onBlur={handleBlur('email')}
      />
      {/* Enter no teclado envia o formulário e avança */}
      <button type="submit" className="visually-hidden" tabIndex={-1}>
        Continuar
      </button>
    </form>
  );
}
