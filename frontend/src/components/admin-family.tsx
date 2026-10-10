'use client';
import { useState, type FormEvent } from 'react';
import type {
  AdminFamily,
  FamilyDashboard,
  FamilySubscription,
  SubscriptionPlan,
  Paginated,
  PlanInput,
} from '@wonderlab/shared';
import { planInputSchema } from '@wonderlab/shared';
import { Search, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi, Loading, ErrorState } from './ui';
import { familyDate, money, ChildSummary, AccessBadge } from './parent-dashboard';
function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div className="admin-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function Pagination({
  data,
  setPage,
  disabled,
}: {
  data: Paginated<unknown>;
  setPage: (page: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="family-pagination">
      <span>
        {data.total} results · Page {data.page} of {Math.max(1, data.totalPages)}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={disabled || data.page <= 1}
          onClick={() => setPage(data.page - 1)}
        >
          Previous
        </button>
        <button
          className="button secondary"
          disabled={disabled || data.page >= data.totalPages}
          onClick={() => setPage(data.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
function Messages({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <p className="family-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="family-success" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
export function AdminFamilies() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<FamilyDashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const { data, error, loading, reload } = useApi<Paginated<AdminFamily>>(
    '/admin/families?' + new URLSearchParams({ page: String(page), pageSize: '12', search: query }),
  );
  const inspect = async (id: string) => {
    setBusy(true);
    setActionError('');
    try {
      setDetail(await api<FamilyDashboard>('/admin/families/' + id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to load family.');
    } finally {
      setBusy(false);
    }
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail) return;
    const values = new FormData(event.currentTarget);
    const trial = String(values.get('trialDays') || '');
    const trialDays = Number(trial);
    if (trial && (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365)) {
      setActionError('Trial days must be an integer from 0 to 365.');
      return;
    }
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api('/admin/families/' + detail.family.id, {
        method: 'PATCH',
        body: JSON.stringify({
          status: values.get('status'),
          ...(trial !== '' ? { trialDays } : {}),
        }),
      });
      setDetail(await api<FamilyDashboard>('/admin/families/' + detail.family.id));
      await reload();
      setNotice('Family access updated.');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to save family.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="family-admin">
      <Heading
        title="Families"
        description="Manage parent workspaces, child access and individual trials."
      />
      <Messages error={actionError} notice={notice} />
      <section className="admin-panel">
        <form
          className="admin-table-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
            setPage(1);
          }}
        >
          <label className="family-search">
            <Search size={17} />
            <span className="sr-only">Search families</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Family, parent name or email"
            />
          </label>
          <button className="button secondary">Search</button>
        </form>
        {loading ? (
          <Loading label="Loading families…" />
        ) : error ? (
          <ErrorState message={error} retry={() => void reload()} />
        ) : (
          data && (
            <>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Family</th>
                      <th>Parent</th>
                      <th>Children</th>
                      <th>Access</th>
                      <th>Trial ends</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((family) => (
                      <tr key={family.id}>
                        <td>
                          <strong>{family.name}</strong>
                          <small>{family.code}</small>
                        </td>
                        <td>
                          <strong>{family.parentName}</strong>
                          <small>{family.parentEmail}</small>
                        </td>
                        <td>
                          {family.childCount} / {family.access.childLimit}
                        </td>
                        <td>
                          <AccessBadge access={family.access} />
                        </td>
                        <td>{familyDate(family.trialEndsAt)}</td>
                        <td>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => void inspect(family.id)}
                          >
                            Manage family
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.data.length && (
                <p className="family-admin-empty">No families match your search.</p>
              )}
              <Pagination data={data} setPage={setPage} disabled={loading || busy} />
            </>
          )
        )}
      </section>
      {detail && (
        <section className="admin-panel family-detail">
          <div className="family-row">
            <div>
              <h2>{detail.family.name}</h2>
              <p>
                Family code: <strong>{detail.family.code}</strong>
                <br />
                Family ID: {detail.family.id}
              </p>
            </div>
            <button
              type="button"
              className="icon-button"
              disabled={busy}
              aria-label="Close family details"
              onClick={() => setDetail(null)}
            >
              <X size={20} />
            </button>
          </div>
          <form
            className="family-form"
            onSubmit={save}
            key={detail.family.id + detail.family.status + detail.family.trialEndsAt}
          >
            <div className="family-form-grid">
              <label>
                Family status
                <select
                  name="status"
                  defaultValue={detail.family.status}
                  key={detail.family.id + detail.family.status}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </label>
              <label>
                Set trial days from today
                <input
                  type="number"
                  name="trialDays"
                  min={0}
                  max={365}
                  step={1}
                  placeholder="Leave blank to keep current trial"
                />
                <small>
                  0 ends the trial immediately. Current expiry:{' '}
                  {familyDate(detail.family.trialEndsAt)}.
                </small>
              </label>
            </div>
            <p className="family-subtle">
              Suspending a family blocks all its children. An active paid period takes precedence
              over a trial.
            </p>
            <button className="button primary" disabled={busy}>
              Save family access
            </button>
          </form>
          <div className="family-row">
            <h3>Child progress</h3>
            <span>
              {detail.access.generationUsed} / {detail.access.generationLimit} creation credits used
            </span>
          </div>
          {detail.children.length ? (
            detail.children.map((child) => <ChildSummary key={child.id} child={child} />)
          ) : (
            <p>This family has no child profiles yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
const newPlan: PlanInput = {
  name: '',
  description: '',
  priceMonthlyCents: 0,
  childLimit: 2,
  generationLimit: 20,
  trialDays: 7,
  isActive: true,
};
export function AdminPlans() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SubscriptionPlan | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const { data, error, loading, reload } = useApi<Paginated<SubscriptionPlan>>(
    '/admin/plans?page=' + page + '&pageSize=12',
  );
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const values = new FormData(event.currentTarget);
    const price = String(values.get('price'));
    if (!/^\d+(\.\d{1,2})?$/.test(price)) {
      setActionError('Enter an MYR price with no more than two decimal places.');
      return;
    }
    const result = planInputSchema.safeParse({
      name: values.get('name'),
      description: values.get('description'),
      priceMonthlyCents: Math.round(Number(price) * 100),
      childLimit: Number(values.get('childLimit')),
      generationLimit: Number(values.get('generationLimit')),
      trialDays: Number(values.get('trialDays')),
      isActive: values.get('isActive') === 'on',
    });
    if (!result.success) {
      setActionError(
        result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' '),
      );
      return;
    }
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api(editing === 'new' ? '/admin/plans' : '/admin/plans/' + editing.id, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        body: JSON.stringify(result.data),
      });
      setEditing(null);
      setNotice('Plan saved. Existing subscriptions keep their activation limits and price.');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to save plan.');
    } finally {
      setBusy(false);
    }
  };
  const plan = editing === 'new' || !editing ? newPlan : editing;
  return (
    <div className="family-admin">
      <Heading
        title="Subscription plans"
        description="Set MYR pricing, child limits, creation credits and default trials."
      />
      <div className="family-admin-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => {
            setEditing('new');
            setActionError('');
          }}
        >
          <Plus size={17} />
          Create plan
        </button>
      </div>
      <Messages error={actionError} notice={notice} />
      {editing && (
        <section className="admin-panel">
          <div className="family-row">
            <h2>{editing === 'new' ? 'Create plan' : 'Edit ' + editing.name}</h2>
            <button
              className="icon-button"
              aria-label="Close plan editor"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              <X size={20} />
            </button>
          </div>
          <form
            className="family-form"
            onSubmit={save}
            key={editing === 'new' ? 'new' : editing.id}
          >
            <div className="family-form-grid">
              <label>
                Plan name
                <input name="name" defaultValue={plan.name} minLength={2} maxLength={80} required />
              </label>
              <label>
                Monthly price (MYR)
                <input
                  name="price"
                  type="number"
                  min={0}
                  max={10000}
                  step="0.01"
                  defaultValue={(plan.priceMonthlyCents / 100).toFixed(2)}
                  required
                />
                <small>Saved as integer cents.</small>
              </label>
              <label>
                Child limit
                <input
                  name="childLimit"
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  defaultValue={plan.childLimit}
                  required
                />
              </label>
              <label>
                Creation credits per period
                <input
                  name="generationLimit"
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  defaultValue={plan.generationLimit}
                  required
                />
              </label>
              <label>
                Default trial days
                <input
                  name="trialDays"
                  type="number"
                  min={0}
                  max={90}
                  step={1}
                  defaultValue={plan.trialDays}
                  required
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                name="description"
                maxLength={500}
                defaultValue={plan.description}
                rows={3}
              />
            </label>
            <label className="family-check">
              <input type="checkbox" name="isActive" defaultChecked={plan.isActive} />
              Available for new requests
            </label>
            <p className="family-subtle">
              Changes apply to new activations. Existing subscriptions retain their saved price and
              limits. Deactivated plans remain in historical records.
            </p>
            <button className="button primary" disabled={busy}>
              Save plan
            </button>
          </form>
        </section>
      )}
      <section className="admin-panel">
        {loading ? (
          <Loading label="Loading plans…" />
        ) : error ? (
          <ErrorState message={error} retry={() => void reload()} />
        ) : (
          data && (
            <>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Monthly price</th>
                      <th>Children</th>
                      <th>Credits</th>
                      <th>Trial</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <small>{item.description}</small>
                        </td>
                        <td>{money(item.priceMonthlyCents)}</td>
                        <td>{item.childLimit}</td>
                        <td>{item.generationLimit}</td>
                        <td>{item.trialDays} days</td>
                        <td>{item.isActive ? 'Available' : 'Inactive'}</td>
                        <td>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => {
                              setEditing(item);
                              setActionError('');
                            }}
                          >
                            Edit plan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.data.length && (
                <p className="family-admin-empty">Create a plan to offer family subscriptions.</p>
              )}
              <Pagination data={data} setPage={setPage} disabled={loading || busy} />
            </>
          )
        )}
      </section>
    </div>
  );
}
export function AdminSubscriptions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<FamilySubscription | 'new' | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const { data, error, loading, reload } = useApi<Paginated<FamilySubscription>>(
    '/admin/subscriptions?' +
      new URLSearchParams({ page: String(page), pageSize: '12', ...(status ? { status } : {}) }),
  );
  const plans = useApi<SubscriptionPlan[]>('/plans');
  const families = useApi<Paginated<AdminFamily>>('/admin/families?page=1&pageSize=100');
  const activate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const familyId = String(values.get('familyId') || '').trim();
    const planId = String(values.get('planId') || '');
    const periodDays = Number(values.get('periodDays'));
    if (
      !familyId ||
      !planId ||
      !Number.isInteger(periodDays) ||
      periodDays < 1 ||
      periodDays > 365
    ) {
      setActionError('Choose a family and plan, and a whole period of 1–365 days.');
      return;
    }
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api('/admin/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ familyId, planId, periodDays }),
      });
      setSelected(null);
      setNotice(
        'Subscription activated. The current plan’s price and limits have been saved for this period.',
      );
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to activate subscription.');
    } finally {
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!confirmCancel) return;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await api('/admin/subscriptions/' + confirmCancel, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      setConfirmCancel(null);
      setNotice('Subscription cancelled.');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unable to cancel subscription.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="family-admin">
      <Heading
        title="Family subscriptions"
        description="Review requests and activate dated access after payment has been arranged."
      />
      <div className="family-admin-actions">
        <button
          className="button primary"
          disabled={busy}
          onClick={() => {
            setSelected('new');
            setActionError('');
          }}
        >
          Activate subscription
        </button>
      </div>
      <Messages error={actionError} notice={notice} />
      {selected && (
        <section className="admin-panel">
          <div className="family-row">
            <h2>Activate paid period</h2>
            <button
              className="icon-button"
              aria-label="Close activation form"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
          </div>
          <p>
            This grants paid access immediately. Confirm payment arrangements before activating; no
            payment is collected here.
          </p>
          {selected !== 'new' && (
            <p>
              <strong>{selected.familyName}</strong> · {selected.parentEmail}
            </p>
          )}
          {plans.error && <ErrorState message={plans.error} retry={() => void plans.reload()} />}
          <form
            className="family-form"
            onSubmit={activate}
            key={selected === 'new' ? 'new' : selected.id}
          >
            <div className="family-form-grid">
              <label>
                Family ID
                <input
                  name="familyId"
                  list={selected === 'new' ? 'subscription-families' : undefined}
                  defaultValue={selected === 'new' ? '' : selected.familyId}
                  readOnly={selected !== 'new'}
                  required
                />
                <datalist id="subscription-families">
                  {families.data?.data.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name} — {family.parentEmail}
                    </option>
                  ))}
                </datalist>
                <small>Select a family, or copy its ID from Families.</small>
              </label>
              <label>
                Plan
                <select
                  name="planId"
                  defaultValue={selected === 'new' ? '' : selected.planId}
                  required
                  disabled={plans.loading}
                >
                  <option value="">Choose an active plan</option>
                  {plans.data?.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {money(plan.priceMonthlyCents)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Period (days)
                <input
                  name="periodDays"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  defaultValue={30}
                  required
                />
              </label>
            </div>
            <label className="family-check">
              <input type="checkbox" required />
              Payment arrangements have been confirmed
            </label>
            <button
              className="button primary"
              disabled={busy || plans.loading || !plans.data?.length}
            >
              Activate paid period
            </button>
          </form>
        </section>
      )}
      {confirmCancel && (
        <section className="admin-panel">
          <h2>Cancel subscription?</h2>
          <p>
            {data?.data.find((item) => item.id === confirmCancel)?.status === 'PENDING'
              ? 'This cancels the pending request. Existing learning access stays as it is.'
              : 'Paid access for this period will end immediately. Any remaining family trial still applies.'}
          </p>
          <div className="family-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirmCancel(null)}
            >
              Keep subscription
            </button>
            <button className="button primary" disabled={busy} onClick={() => void cancel()}>
              Confirm cancellation
            </button>
          </div>
        </section>
      )}
      <section className="admin-panel">
        <div className="admin-table-toolbar">
          <label className="family-filter">
            Filter status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All subscriptions</option>
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </div>
        {loading ? (
          <Loading label="Loading subscriptions…" />
        ) : error ? (
          <ErrorState message={error} retry={() => void reload()} />
        ) : (
          data && (
            <>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Family</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Saved limits</th>
                      <th>Period</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.familyName}</strong>
                          <small>{item.parentEmail}</small>
                        </td>
                        <td>
                          <strong>{item.planName}</strong>
                          <small>{money(item.priceMonthlyCents)} / month</small>
                        </td>
                        <td>
                          <span
                            className={
                              'family-badge ' + (item.status === 'ACTIVE' ? 'positive' : 'muted')
                            }
                          >
                            {item.status.toLowerCase()}
                          </span>
                        </td>
                        <td>
                          {item.childLimit} children
                          <small>{item.generationLimit} creation credits</small>
                        </td>
                        <td>
                          {familyDate(item.startsAt)}
                          <small>to {familyDate(item.endsAt)}</small>
                        </td>
                        <td>
                          <div className="family-actions">
                            {item.status === 'PENDING' && (
                              <button
                                className="button secondary"
                                disabled={busy}
                                onClick={() => {
                                  setSelected(item);
                                  setActionError('');
                                }}
                              >
                                Review & activate
                              </button>
                            )}
                            {(item.status === 'PENDING' || item.status === 'ACTIVE') && (
                              <button
                                className="family-quiet family-danger"
                                disabled={busy}
                                onClick={() => setConfirmCancel(item.id)}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.data.length && (
                <p className="family-admin-empty">No subscriptions match this status.</p>
              )}
              <Pagination data={data} setPage={setPage} disabled={loading || busy} />
            </>
          )
        )}
      </section>
    </div>
  );
}
