"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ClientFilterContextType {
  customerId: string;
  setCustomerId: (id: string) => void;
  customers: { id: string; name: string }[];
  setCustomers: (c: { id: string; name: string }[]) => void;
}

const ClientFilterContext = createContext<ClientFilterContextType>({
  customerId: "",
  setCustomerId: () => {},
  customers: [],
  setCustomers: () => {},
});

export function ClientFilterProvider({ children }: { children: ReactNode }) {
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>(
    [],
  );

  return (
    <ClientFilterContext.Provider
      value={{ customerId, setCustomerId, customers, setCustomers }}
    >
      {children}
    </ClientFilterContext.Provider>
  );
}

export function useClientFilter() {
  return useContext(ClientFilterContext);
}
