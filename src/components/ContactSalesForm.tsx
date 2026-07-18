'use client'

/**
 * ContactSalesForm — the "Contact us" experience for custom/enterprise plans.
 *
 * Drop this in place of a Subscribe button when a plan is a custom tier
 * (`plan.metadata?.pricing_type === 'custom'`). On submit it creates a sales
 * lead (via client.leads.create) that the business sees in its admin Leads
 * page. Works for anonymous visitors — only the app's API key is required.
 *
 * @example
 * ```tsx
 * {plan.metadata?.pricing_type === 'custom'
 *   ? <ContactSalesForm planId={plan.id} planName={plan.name} />
 *   : <SubscribeButton plan={plan} />}
 * ```
 */

import React, { useState } from 'react'
import { useScaleMuleContext } from '../context'

export interface ContactSalesFormProps {
  /** The custom plan this enquiry is about. */
  planId?: string
  planName?: string
  heading?: string
  submitLabel?: string
  successMessage?: string
  /** Called with the new lead id after a successful submit. */
  onSuccess?: (leadId?: string) => void
  onError?: (error: Error) => void
  /** Root className for styling. Fields use `data-scalemule-field` attributes. */
  className?: string
}

const EMPTY = {
  firstName: '', lastName: '', email: '', phone: '',
  jobTitle: '', company: '', country: '', employees: '', message: '',
}

export function ContactSalesForm({
  planId,
  planName,
  heading = 'Contact our sales team',
  submitLabel = 'Contact us',
  successMessage = 'Thanks — our sales team will be in touch shortly.',
  onSuccess,
  onError,
  className,
}: ContactSalesFormProps) {
  const { client } = useScaleMuleContext()
  const [f, setF] = useState({ ...EMPTY })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const set =
    (k: keyof typeof EMPTY) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF((prev) => ({ ...prev, [k]: e.target.value }))

  const canSubmit = f.firstName.trim() !== '' && f.email.trim() !== '' && status !== 'submitting'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('submitting')
    setError(null)
    try {
      const res = await client.leads.create({
        contactName: `${f.firstName} ${f.lastName}`.trim(),
        contactEmail: f.email.trim(),
        contactPhone: f.phone || undefined,
        jobTitle: f.jobTitle || undefined,
        company: f.company || undefined,
        country: f.country || undefined,
        employees: f.employees || undefined,
        message: f.message || undefined,
        planId,
        planName,
      })
      if (res.error) throw new Error(res.error.message || 'Failed to submit')
      setStatus('done')
      onSuccess?.(res.data?.id)
    } catch (err) {
      const e2 = err instanceof Error ? err : new Error(String(err))
      setStatus('error')
      setError(e2.message)
      onError?.(e2)
    }
  }

  if (status === 'done') {
    return (
      <div className={className} data-scalemule="contact-sales-success" role="status">
        {successMessage}
      </div>
    )
  }

  return (
    <form className={className} data-scalemule="contact-sales-form" onSubmit={submit}>
      {heading ? <h3 data-scalemule-field="heading">{heading}</h3> : null}
      {planName ? <p data-scalemule-field="plan">Plan: {planName}</p> : null}

      <label data-scalemule-field="firstName">
        First name*
        <input required value={f.firstName} onChange={set('firstName')} autoComplete="given-name" />
      </label>
      <label data-scalemule-field="lastName">
        Last name
        <input value={f.lastName} onChange={set('lastName')} autoComplete="family-name" />
      </label>
      <label data-scalemule-field="email">
        Business email*
        <input required type="email" value={f.email} onChange={set('email')} autoComplete="email" />
      </label>
      <label data-scalemule-field="phone">
        Phone
        <input type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
      </label>
      <label data-scalemule-field="jobTitle">
        Job title
        <input value={f.jobTitle} onChange={set('jobTitle')} autoComplete="organization-title" />
      </label>
      <label data-scalemule-field="company">
        Company name
        <input value={f.company} onChange={set('company')} autoComplete="organization" />
      </label>
      <label data-scalemule-field="country">
        Country
        <input value={f.country} onChange={set('country')} autoComplete="country-name" />
      </label>
      <label data-scalemule-field="employees">
        Employees
        <select value={f.employees} onChange={set('employees')}>
          <option value="">Select…</option>
          <option value="1-20">1 - 20</option>
          <option value="21-250">21 - 250</option>
          <option value="251-1000">251 - 1,000</option>
          <option value="1000+">1,000+</option>
        </select>
      </label>
      <label data-scalemule-field="message">
        How can sales help you?
        <textarea value={f.message} onChange={set('message')} rows={3} />
      </label>

      {error ? (
        <p data-scalemule-field="error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" data-scalemule-field="submit" disabled={!canSubmit}>
        {status === 'submitting' ? 'Sending…' : submitLabel}
      </button>
    </form>
  )
}
