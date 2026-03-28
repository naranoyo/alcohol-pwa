// lib/state.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { loadFromStorage, saveToStorage } from "./storage";

export type Sex = "male" | "female";

export type DrinkInput = {
  id: string;
  name: string;
  volumeMl: number;
  abv: number;
  count: number;
  locked?: boolean;
};

export type HistoryItem = {
  id: string;
  createdAt: string;
  weightKg: number;
  sex: Sex;
  startTime: string;
  endTime: string;
  elapsedHoursAfterEnd: number;
  drinks: DrinkInput[];
  totalPureAlcoholG: number;
  remainingAtEndG: number;
  remainingNowG: number;
  metabolismGPerHour: number;
  hoursToZeroFromNow: number;
  estimatedBacNow: number;
};

export type AppState = {
  weightKg: number;
  sex: Sex;
  startTime: string;
  endTime: string;
  elapsedHoursAfterEnd: number;
  drinks: DrinkInput[];
  histories: HistoryItem[];
};

type Action =
  | { type: "INIT"; payload: AppState }
  | { type: "SET_WEIGHT"; payload: number }
  | { type: "SET_SEX"; payload: Sex }
  | { type: "SET_START_TIME"; payload: string }
  | { type: "SET_END_TIME"; payload: string }
  | { type: "SET_ELAPSED_AFTER_END"; payload: number }
  | { type: "ADD_DRINK" }
  | {
      type: "UPDATE_DRINK";
      payload: {
        id: string;
        field: keyof DrinkInput;
        value: string | number | boolean;
      };
    }
  | { type: "DELETE_DRINK"; payload: { id: string } }
  | { type: "TOGGLE_DRINK_LOCK"; payload: { id: string } }
  | { type: "ADD_HISTORY"; payload: HistoryItem }
  | { type: "DELETE_HISTORY"; payload: { id: string } }
  | { type: "LOAD_HISTORY"; payload: { id: string } }
  | { type: "RESET_ALL" };

function createDefaultDrink(): DrinkInput {
  return {
    id: crypto.randomUUID(),
    name: "ビール",
    volumeMl: 350,
    abv: 5,
    count: 1,
    locked: false,
  };
}

function cloneDrink(drink: DrinkInput): DrinkInput {
  return {
    ...drink,
    id: crypto.randomUUID(),
    locked: false,
  };
}

const initialState: AppState = {
  weightKg: 60,
  sex: "male",
  startTime: "19:00",
  endTime: "21:00",
  elapsedHoursAfterEnd: 0,
  drinks: [createDefaultDrink()],
  histories: [],
};

function normalizeDrink(drink: DrinkInput): DrinkInput {
  return {
    ...drink,
    locked: Boolean(drink.locked),
  };
}

function normalizeHistoryItem(item: HistoryItem): HistoryItem {
  return {
    ...item,
    drinks: Array.isArray(item.drinks) ? item.drinks.map(normalizeDrink) : [],
    remainingAtEndG:
      typeof item.remainingAtEndG === "number" &&
      Number.isFinite(item.remainingAtEndG)
        ? item.remainingAtEndG
        : item.remainingNowG,
    metabolismGPerHour:
      typeof item.metabolismGPerHour === "number" &&
      Number.isFinite(item.metabolismGPerHour)
        ? item.metabolismGPerHour
        : 0,
  };
}

function normalizeState(state: AppState): AppState {
  return {
    ...state,
    drinks: Array.isArray(state.drinks)
      ? state.drinks.map(normalizeDrink)
      : [createDefaultDrink()],
    histories: Array.isArray(state.histories)
      ? state.histories.map(normalizeHistoryItem)
      : [],
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "INIT":
      return normalizeState(action.payload);

    case "SET_WEIGHT":
      return {
        ...state,
        weightKg: Number.isFinite(action.payload)
          ? Math.max(30, Math.min(120, action.payload))
          : state.weightKg,
      };

    case "SET_SEX":
      return {
        ...state,
        sex: action.payload,
      };

    case "SET_START_TIME":
      return {
        ...state,
        startTime: action.payload,
      };

    case "SET_END_TIME":
      return {
        ...state,
        endTime: action.payload,
      };

    case "SET_ELAPSED_AFTER_END":
      return {
        ...state,
        elapsedHoursAfterEnd: Number.isFinite(action.payload)
          ? Math.max(0, Math.min(48, action.payload))
          : state.elapsedHoursAfterEnd,
      };

    case "ADD_DRINK":
      return {
        ...state,
        drinks: [
          ...state.drinks.map((drink) => ({ ...drink, locked: true })),
          createDefaultDrink(),
        ],
      };

    case "UPDATE_DRINK":
      return {
        ...state,
        drinks: state.drinks.map((drink) =>
          drink.id === action.payload.id
            ? ({
                ...drink,
                [action.payload.field]: action.payload.value,
              } as DrinkInput)
            : drink
        ),
      };

    case "DELETE_DRINK": {
      const next = state.drinks.filter(
        (drink) => drink.id !== action.payload.id
      );

      return {
        ...state,
        drinks: next.length > 0 ? next : [createDefaultDrink()],
      };
    }

    case "TOGGLE_DRINK_LOCK":
      return {
        ...state,
        drinks: state.drinks.map((drink) =>
          drink.id === action.payload.id
            ? { ...drink, locked: !drink.locked }
            : drink
        ),
      };

    case "ADD_HISTORY":
      return {
        ...state,
        histories: [normalizeHistoryItem(action.payload), ...state.histories],
      };

    case "DELETE_HISTORY":
      return {
        ...state,
        histories: state.histories.filter(
          (item) => item.id !== action.payload.id
        ),
      };

    case "LOAD_HISTORY": {
      const target = state.histories.find(
        (item) => item.id === action.payload.id
      );
      if (!target) return state;

      return {
        ...state,
        weightKg: target.weightKg,
        sex: target.sex,
        startTime: target.startTime,
        endTime: target.endTime,
        elapsedHoursAfterEnd: target.elapsedHoursAfterEnd,
        drinks:
          target.drinks.length > 0
            ? target.drinks.map(cloneDrink)
            : [createDefaultDrink()],
      };
    }

    case "RESET_ALL":
      return {
        ...initialState,
        histories: state.histories,
        drinks: [createDefaultDrink()],
      };

    default:
      return state;
  }
}

type AppContextValue = {
  state: AppState;
  dispatch: React.Dispatch<Action>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const saved = loadFromStorage();
    if (saved) {
      dispatch({ type: "INIT", payload: saved });
    }
  }, []);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
}
