/** Standard fixed-rate monthly payment (amortization). */
export function monthlyLoanPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export function loanPrincipal(vehiclePrice: number, downPaymentSaved: number): number {
  return Math.max(0, vehiclePrice - downPaymentSaved);
}
