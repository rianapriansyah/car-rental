/**
 * Income booked as `rental_income` at completion (matches `complete_rental` remainder).
 * DP is stored separately as `dp_rental_income` at check-in.
 */
export function checkoutRentalIncomeAmount(grossIncome: number, downPayment: number): number {
  const g = Number.isFinite(grossIncome) ? grossIncome : 0
  const d = Number.isFinite(downPayment) ? downPayment : 0
  return Math.max(0, g - d)
}
