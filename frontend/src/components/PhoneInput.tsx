import React from 'react';
import { QATAR_DIAL_CODE } from '../utils/phone';
import { label } from '../theme';

interface PhoneInputProps {
  id?: string;
  labelText?: string;
  required?: boolean;
  value: string;
  onChange: (localDigits: string) => void;
  placeholder?: string;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  id = 'phoneNumber',
  labelText = 'Phone Number',
  required = false,
  value,
  onChange,
  placeholder = '5555 1234',
}) => (
  <div>
    <label className={label} htmlFor={id}>
      {labelText}
      {required && <span className="text-red-500"> *</span>}
    </label>
    <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-400">
      <span className="flex items-center px-3 text-sm font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 shrink-0">
        {QATAR_DIAL_CODE}
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder={placeholder}
        className="w-full flex-1 border-0 bg-transparent px-4 py-3 text-base text-slate-900 focus:outline-none"
        required={required}
        autoComplete="tel-national"
      />
    </div>
  </div>
);

export default PhoneInput;
