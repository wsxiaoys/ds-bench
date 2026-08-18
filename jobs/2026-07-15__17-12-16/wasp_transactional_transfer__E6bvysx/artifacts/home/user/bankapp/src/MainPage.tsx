import React, { useState } from 'react'
import { useQuery, getAccounts, getLedger, transferFunds } from 'wasp/client/operations'

export const MainPage = () => {
  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useQuery(getAccounts)
  const { data: ledger, isLoading: ledgerLoading, error: ledgerError } = useQuery(getLedger)

  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)

    if (!from || !to) {
      setStatus({ type: 'error', message: 'Please select both sender and recipient accounts.' })
      return
    }

    if (from === to) {
      setStatus({ type: 'error', message: 'Sender and recipient accounts must be different.' })
      return
    }

    const parsedAmount = parseInt(amount, 10)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setStatus({ type: 'error', message: 'Amount must be a positive integer.' })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await transferFunds({
        from,
        to,
        amount: parsedAmount,
      })

      setStatus({
        type: 'success',
        message: `Successfully transferred ${result.amount} units from ${result.from.name} to ${result.to.name}! Ledger count is now ${result.ledgerCount}.`,
      })
      setAmount('')
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.message || 'An unexpected error occurred.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '2rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        <h1 style={{ margin: 0, color: '#333' }}>bankapp 🏦</h1>
        <p style={{ color: '#666', margin: '0.5rem 0 0 0' }}>Atomic money transfers with full ledger history.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left Column: Accounts & Transfer Form */}
        <div>
          <section style={{ backgroundColor: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <h2 style={{ marginTop: 0, color: '#444' }}>Accounts</h2>
            {accountsLoading && <p>Loading accounts...</p>}
            {accountsError && <p style={{ color: 'red' }}>Error loading accounts: {accountsError.message}</p>}
            {accounts && accounts.length === 0 && <p>No accounts found.</p>}
            {accounts && accounts.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ textAlign: 'left', padding: '8px' }}>Account Name</th>
                    <th style={{ textAlign: 'right', padding: '8px' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc: any) => (
                    <tr key={acc.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px' }}><strong>{acc.name}</strong></td>
                      <td style={{ padding: '8px', textAlign: 'right', color: acc.balance >= 0 ? 'green' : 'red' }}>
                        {acc.balance} units
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section style={{ backgroundColor: '#f9f9f9', padding: '1.5rem', borderRadius: '8px' }}>
            <h2 style={{ marginTop: 0, color: '#444' }}>Transfer Funds</h2>
            <form onSubmit={handleTransfer}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>From Account:</label>
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">-- Select Sender --</option>
                  {accounts?.map((acc: any) => (
                    <option key={acc.id} value={acc.name}>
                      {acc.name} ({acc.balance} units)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>To Account:</label>
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">-- Select Recipient --</option>
                  {accounts?.map((acc: any) => (
                    <option key={acc.id} value={acc.name}>
                      {acc.name} ({acc.balance} units)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Amount:</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter positive integer amount"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  backgroundColor: '#bf9900',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  width: '100%',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Processing...' : 'Transfer'}
              </button>
            </form>

            {status && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '10px',
                  borderRadius: '4px',
                  backgroundColor: status.type === 'success' ? '#e6f4ea' : '#fce8e6',
                  color: status.type === 'success' ? '#137333' : '#c5221f',
                  border: `1px solid ${status.type === 'success' ? '#34a853' : '#ea4335'}`,
                }}
              >
                {status.message}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Ledger History */}
        <div>
          <section style={{ backgroundColor: '#f9f9f9', padding: '1.5rem', borderRadius: '8px', minHeight: '400px' }}>
            <h2 style={{ marginTop: 0, color: '#444' }}>Ledger History</h2>
            {ledgerLoading && <p>Loading ledger...</p>}
            {ledgerError && <p style={{ color: 'red' }}>Error loading ledger: {ledgerError.message}</p>}
            {ledger && ledger.length === 0 && <p style={{ color: '#666' }}>No transfers recorded yet.</p>}
            {ledger && ledger.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ledger.map((entry: any) => (
                  <div
                    key={entry.id}
                    style={{
                      backgroundColor: '#fff',
                      padding: '10px',
                      borderRadius: '4px',
                      border: '1px solid #eee',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', color: '#333' }}>
                        {entry.fromAccount.name} ➡️ {entry.toAccount.name}
                      </span>
                      <span style={{ color: 'green', fontWeight: 'bold' }}>+{entry.amount} units</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#999' }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
