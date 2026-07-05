import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Démonte les composants montés entre chaque test (évite les fuites de DOM
// et les doublons de sélecteurs). Sans effet en environnement node.
afterEach(() => {
  cleanup();
});
