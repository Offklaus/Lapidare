/* Cliente logada (login com Google), disponível para o site inteiro. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { USE_MOCK } from '../services/api.js';
import { customerLogout, getCustomerMe } from '../services/customerApi.js';

const CustomerContext = createContext({
  customer: null,
  loading: false,
  setCustomer: () => {},
  logout: async () => {},
});

export function CustomerProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(!USE_MOCK);

  // Ao abrir o site, descobre se já existe uma sessão (cookie). Sem sessão: segue como visitante.
  useEffect(() => {
    if (USE_MOCK) return undefined;
    let alive = true;
    getCustomerMe()
      .then((data) => alive && setCustomer(data.customer))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await customerLogout();
    } finally {
      setCustomer(null);
    }
  }, []);

  const value = useMemo(() => ({ customer, loading, setCustomer, logout }), [customer, loading, logout]);
  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export const useCustomer = () => useContext(CustomerContext);
