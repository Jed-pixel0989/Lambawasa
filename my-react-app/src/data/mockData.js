// Empty initial records keep a new installation free of sample customer data.
export const initialConsumers = []
export const initialMeters = []
export const initialGeoPins = []
export const initialBills = []
export const initialPayments = []
export const initialComplaints = []
export const initialAuditLogs = []
export const initialStaff = []
export const initialNotifications = []
export const initialAdjustments = []
export const initialRatings = []
export const consumerPortalAccounts = []

export function calculateConsumptionBill(prevReading, presReading) {
  const prev = Number(prevReading) || 0
  const pres = Number(presReading) || 0
  const consumption = Math.max(0, pres - prev)
  const baseAmount = +(consumption * 10).toFixed(2)
  const bracketBreakdown = []
  if (consumption > 0) {
    bracketBreakdown.push({
      label: '₱10 per m³',
      cuM: consumption,
      rate: 10,
      amount: baseAmount,
    })
  }
  const envFee = +(baseAmount * 0.10).toFixed(2)
  const maintFee = 2
  const totalAmount = +(baseAmount + envFee + maintFee).toFixed(2)

  return {
    consumption,
    baseAmount: +baseAmount.toFixed(2),
    envFee,
    maintFee,
    totalAmount,
    bracketBreakdown,
  }
}
