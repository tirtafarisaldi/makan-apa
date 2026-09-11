import * as React from "react";
import { render, screen } from "@testing-library/react";
import App from "../src/components/App";

describe("App", () => {
  test("renders food recommendation form and heading", () => {
    render(<App />);

    expect(screen.getByText("Makan Apa")).toBeTruthy();
    expect(screen.getByLabelText("Budget")) .toBeTruthy();
    expect(screen.getByLabelText("Kategori makanan")) .toBeTruthy();
  });
});
