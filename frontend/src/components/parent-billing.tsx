'use client';
import { useState } from 'react';
import type { FamilyBilling } from '@wonderlab/shared';
import { CreditCard, Check, Sparkles, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, Loading, ErrorState, ProgressBar } from './ui';
import { LocalizedText } from './i18n';
import { AccessBadge, familyDate, money } from './parent-dashboard';
export function ParentBilling() {
  const { data, error, loading, reload } = useApi<FamilyBilling>('/parent/billing');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const action = async (path: string, body: unknown, message: string) => {
    setBusy(true);
    setNotice('');
    setActionError('');
    try {
      await api(path, { method: 'POST', body: JSON.stringify(body) });
      setNotice(message);
      setConfirmCancel(null);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to update your subscription.');
    } finally {
      setBusy(false);
    }
  };
  if (loading && !data) return <Loading label="Loading subscriptions…" />;
  if (!data)
    return (
      <ErrorState message={error || 'Unable to load subscriptions.'} retry={() => void reload()} />
    );
  return (
    <>
      <div className="family-heading">
        <h1>
          <LocalizedText text="A plan for your whole family." />
        </h1>
        <p>
          <LocalizedText text="One subscription, shared lesson credits, and a space for each child." />
        </p>
      </div>
      {actionError && (
        <p role="alert" className="family-error">
          {actionError}
        </p>
      )}
      {error && <ErrorState message={error} retry={() => void reload()} />}
      {notice && (
        <p role="status" className="family-success">
          <LocalizedText text={notice} />
        </p>
      )}
      <section className="family-panel">
        <div className="family-row">
          <h2>
            <LocalizedText text="Your subscription" />
          </h2>
          <AccessBadge access={data.access} />
        </div>
        <div className="family-billing-current">
          <div>
            <CreditCard size={26} />
            <strong>
              {data.subscription?.planName || (
                <LocalizedText
                  text={data.access.status === 'TRIALING' ? 'Family trial' : 'No active plan'}
                />
              )}
            </strong>
            <span>
              <LocalizedText text="Current period ends" />: {familyDate(data.access.periodEndsAt)}
            </span>
            {data.family.trialEndsAt && (
              <span>
                <LocalizedText text="Trial ends" />: {familyDate(data.family.trialEndsAt)}
              </span>
            )}
          </div>
          <div>
            <p>
              <LocalizedText text="Lessons created this period" />
              <strong>
                {data.access.generationUsed} / {data.access.generationLimit}
              </strong>
            </p>
            <ProgressBar
              value={(data.access.generationUsed / Math.max(1, data.access.generationLimit)) * 100}
            />
            <small>
              <LocalizedText text="Playing existing lessons does not use creation credits." />
            </small>
          </div>
        </div>
        {data.pendingSubscription && (
          <div className="family-notice">
            <strong>
              <LocalizedText text="Awaiting activation" />: {data.pendingSubscription.planName}
            </strong>
            <p>
              <LocalizedText text="Your request is saved. An administrator will activate your plan after payment is arranged." />
            </p>
            <button
              className="family-quiet"
              disabled={busy}
              onClick={() => setConfirmCancel(data.pendingSubscription!.id)}
            >
              <LocalizedText text="Cancel request" />
            </button>
          </div>
        )}
        {data.subscription && (
          <button
            className="family-quiet family-danger"
            disabled={busy}
            onClick={() => setConfirmCancel(data.subscription!.id)}
          >
            <LocalizedText text="Cancel current subscription" />
          </button>
        )}
        {confirmCancel && (
          <div className="family-notice">
            <p>
              <LocalizedText
                text={
                  confirmCancel === data.subscription?.id
                    ? 'Cancel this subscription? Paid access ends immediately. Any remaining trial will still apply.'
                    : 'Cancel this plan request?'
                }
              />
            </p>
            <div className="family-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setConfirmCancel(null)}
              >
                <LocalizedText text="Keep it" />
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  void action(
                    '/parent/subscriptions/' + confirmCancel + '/cancel',
                    {},
                    'Subscription cancelled.',
                  )
                }
              >
                <LocalizedText text="Confirm cancellation" />
              </button>
            </div>
          </div>
        )}
      </section>
      <div className="family-section-heading">
        <h2>
          <LocalizedText text="Choose your next chapter" />
        </h2>
        <p>
          <LocalizedText text="Request a plan below. Payment and activation are arranged by an administrator; selecting a plan does not charge you." />
        </p>
      </div>
      <div className="family-plan-grid">
        {data.plans.map((plan) => (
          <section className="family-panel family-plan" key={plan.id}>
            <h3>{plan.name}</h3>
            <p>{plan.description}</p>
            <div className="family-plan-price">
              {money(plan.priceMonthlyCents)}
              <small>
                <LocalizedText text="per month" />
              </small>
            </div>
            <ul>
              <li>
                <Users size={17} />
                {plan.childLimit} <LocalizedText text="Child profiles" />
              </li>
              <li>
                <Sparkles size={17} />
                {plan.generationLimit} <LocalizedText text="Lesson creation credits per period" />
              </li>
              <li>
                <Check size={17} />
                <LocalizedText text="Individual progress and parent controls" />
              </li>
            </ul>
            <button
              className="button primary"
              disabled={busy || Boolean(data.pendingSubscription)}
              onClick={() =>
                void action(
                  '/parent/subscriptions',
                  { planId: plan.id },
                  'Plan requested. Awaiting administrator activation.',
                )
              }
            >
              <LocalizedText
                text={
                  data.pendingSubscription?.planId === plan.id
                    ? 'Request pending'
                    : 'Request this plan'
                }
              />
            </button>
          </section>
        ))}
      </div>
      {!data.plans.length && (
        <div className="family-empty">
          <p>
            <LocalizedText text="No plans are available right now. Please contact your administrator." />
          </p>
        </div>
      )}
      <section className="family-panel">
        <h2>
          <LocalizedText text="Subscription history" />
        </h2>
        {data.history.length ? (
          <div className="family-table-wrap">
            <table className="family-table">
              <thead>
                <tr>
                  {['Plan', 'Status', 'Price', 'Period'].map((text) => (
                    <th key={text}>
                      <LocalizedText text={text} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.history.map((item) => (
                  <tr key={item.id}>
                    <td>{item.planName}</td>
                    <td>
                      <LocalizedText
                        text={
                          item.status === 'PENDING'
                            ? 'Pending'
                            : item.status === 'ACTIVE'
                              ? 'Active'
                              : item.status === 'EXPIRED'
                                ? 'Expired'
                                : 'Cancelled'
                        }
                      />
                    </td>
                    <td>{money(item.priceMonthlyCents)}</td>
                    <td>
                      {familyDate(item.startsAt)} – {familyDate(item.endsAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="family-subtle">
            <LocalizedText text="Your plan requests and subscriptions will appear here." />
          </p>
        )}
      </section>
    </>
  );
}
