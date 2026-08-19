"use client";

import { useEffect } from "react";

/** Full-screen black chrome for the collection tracker on phones and small tablets. */
export default function PokemonCardsBodyLock() {
  useEffect(() => {
    document.documentElement.classList.add("pokemon-cards-active");
    document.body.classList.add("pokemon-cards-active");
    return () => {
      document.documentElement.classList.remove("pokemon-cards-active");
      document.body.classList.remove("pokemon-cards-active");
    };
  }, []);

  return null;
}
