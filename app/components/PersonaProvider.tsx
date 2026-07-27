"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PERSONA_DEFINITIONS,
  parseDashboardPersona,
  type DashboardPersona,
  type PersonaDefinition,
} from "../lib/dashboard-persona";

const PERSONA_STORAGE_KEY = "jataka.dashboard.persona";

interface PersonaContextValue {
  activePersona: DashboardPersona;
  activeDefinition: PersonaDefinition;
  selectPersona: (persona: DashboardPersona) => void;
}

const defaultDefinition = PERSONA_DEFINITIONS.ARCHITECT;

const PersonaContext = createContext<PersonaContextValue>({
  activePersona: "ARCHITECT",
  activeDefinition: defaultDefinition,
  selectPersona: () => undefined,
});

interface PersonaProviderProps {
  children: ReactNode;
  initialPersona?: DashboardPersona;
}

export function PersonaProvider({
  children,
  initialPersona = "ARCHITECT",
}: PersonaProviderProps) {
  const router = useRouter();
  const [activePersona, setActivePersona] =
    useState<DashboardPersona>(initialPersona);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPersona = parseDashboardPersona(params.get("persona"));
    const storedPersona = parseDashboardPersona(
      window.localStorage.getItem(PERSONA_STORAGE_KEY),
    );
    const nextPersona = urlPersona || storedPersona || initialPersona;

    window.localStorage.setItem(PERSONA_STORAGE_KEY, nextPersona);
    const hydrationTimer = window.setTimeout(
      () => setActivePersona(nextPersona),
      0,
    );

    const handleHistoryChange = () => {
      const historyPersona = parseDashboardPersona(
        new URLSearchParams(window.location.search).get("persona"),
      );
      if (historyPersona) setActivePersona(historyPersona);
    };

    window.addEventListener("popstate", handleHistoryChange);
    return () => {
      window.clearTimeout(hydrationTimer);
      window.removeEventListener("popstate", handleHistoryChange);
    };
  }, [initialPersona]);

  const selectPersona = useCallback(
    (persona: DashboardPersona) => {
      setActivePersona(persona);
      window.localStorage.setItem(PERSONA_STORAGE_KEY, persona);
      const definition = PERSONA_DEFINITIONS[persona];
      router.push(`${definition.homePath}?persona=${definition.slug}`);
    },
    [router],
  );

  const value = useMemo(
    () => ({
      activePersona,
      activeDefinition: PERSONA_DEFINITIONS[activePersona],
      selectPersona,
    }),
    [activePersona, selectPersona],
  );

  return (
    <PersonaContext.Provider value={value}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  return useContext(PersonaContext);
}
