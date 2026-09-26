import { useCallback, useEffect, useState } from 'react';

/**
 * Executa uma função assíncrona quando `deps` mudam (deps devem ser valores simples: texto, número, booleano).
 * Retorna { data, loading, error, reload }. Respostas antigas são descartadas.
 *
 * No render logo depois de `deps` mudar, o efeito ainda não rodou: nesse instante já devolvemos
 * loading = true e sem erro antigo, para ninguém mostrar dados de outra busca como se fossem desta.
 * `data` continua sendo o último resultado (útil para manter a lista na tela enquanto atualiza).
 */
export default function useAsync(fn, deps) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([...deps, attempt]);
  const [state, setState] = useState({ data: null, loading: true, error: null, key: null });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(fn)
      .then((data) => alive && setState({ data, loading: false, error: null, key }))
      .catch((error) => alive && setState({ data: null, loading: false, error, key }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const stale = state.key !== key;
  return {
    data: state.data,
    loading: state.loading || stale,
    error: stale ? null : state.error,
    reload,
  };
}
