import { useState } from "react";

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(value);

export default function LoanCalculator() {
  const [price, setPrice] = useState("");
  const [rate, setRate] = useState("5");
  const [months, setMonths] = useState("36");
  const [downPayment, setDownPayment] = useState("");

  const priceNum = Number(price.replace(/,/g, "")) || 0;
  const rateNum = Number(rate) || 0;
  const monthsNum = Math.max(1, Math.round(Number(months) || 36));
  const downNum = Number(downPayment.replace(/,/g, "")) || 0;
  const principal = Math.max(0, priceNum - downNum);

  const canCalculate = priceNum > 0 && rateNum > 0 && monthsNum > 0;

  let monthlyPayment = 0;
  let totalInterest = 0;
  let totalPayments = 0;

  if (canCalculate && principal > 0) {
    const monthlyRate = rateNum / 100 / 12;
    const factor = Math.pow(1 + monthlyRate, monthsNum);
    monthlyPayment = (principal * monthlyRate * factor) / (factor - 1);
    totalPayments = monthlyPayment * monthsNum;
    totalInterest = totalPayments - principal;
  }

  return (
    <div className="calc-wrapper">
      <div className="calc-intro">
        <h2>Loan Calculator</h2>
        <p>
          Use our loan calculator to calculate payments over the life of your
          loan. Enter your information to see how much your monthly payments
          could be. You can adjust length of loan, down payment and interest
          rate to see how those changes raise or lower your payments.
        </p>
      </div>

      <form className="calc-fields" onSubmit={(e) => e.preventDefault()}>
        <label>
          <span>
            Price <span className="required">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 20000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <label>
          <span>
            Interest Rate <span className="required">*</span>
          </span>
          <div className="input-with-suffix">
            <input
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <span className="suffix">%</span>
          </div>
        </label>

        <label>
          <span>
            Period (months) <span className="required">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
        </label>

        <label>
          <span>Down Payment</span>
          <div className="input-with-suffix">
            <span className="prefix">$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value)}
            />
          </div>
        </label>
      </form>

      <div className="results">
        <div className="result-col">
          <h3>Monthly Payment</h3>
          <p className="result-value">
            {canCalculate ? formatCurrency(monthlyPayment) : "-"}
          </p>
        </div>
        <div className="result-col">
          <h3>Total Interest</h3>
          <p className="result-value">
            {canCalculate ? formatCurrency(totalInterest) : "-"}
          </p>
        </div>
        <div className="result-col">
          <h3>Total Payments</h3>
          <p className="result-value">
            {canCalculate ? formatCurrency(totalPayments) : "-"}
          </p>
        </div>
      </div>

      <p className="disclaimer">
        Title and other fees and incentives are not included in this
        calculation, which is an estimate only. Monthly payment estimates are
        for informational purpose and do not represent a financing offer from
        the seller of this vehicle. Other taxes may apply.
      </p>
    </div>
  );
}
