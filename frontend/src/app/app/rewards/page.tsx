'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Gift, Star } from 'lucide-react';
import type {
  FamilyReward,
  Paginated,
  RewardRedemption,
  StarTransaction,
  StarWallet,
} from '@wonderlab/shared';
import { api } from '@/lib/api';
import { useSession } from '@/components/session';
import { LocalizedText as Text } from '@/components/i18n';
import { ErrorState, Loading, Modal } from '@/components/ui';
import {
  RewardDate,
  RewardPicture,
  RewardsPagination,
  rewardStatus,
  starsChanged,
  useRewardsApi,
} from '@/components/rewards-ui';

export default function RewardsPage() {
  const { user } = useSession();
  if (!user) return <Loading />;
  if (user.accountType !== 'CHILD' || !user.familyId)
    return (
      <section className="rewards-page family-panel rewards-setup">
        <Gift size={46} />
        <h1>
          <Text text="Family prizes grow together" />
        </h1>
        <p>
          <Text text="Stars and prizes belong to child profiles in a family. A parent sets up the prizes and decides when to give them." />
        </p>
        <Link
          className="button primary"
          href={user.accountType === 'PARENT' ? '/parent/rewards' : '/parent/login'}
        >
          <Text text={user.accountType === 'PARENT' ? 'Open family prizes' : 'Open parent space'} />
        </Link>
      </section>
    );
  return <ChildRewards key={user.id} childId={user.id} />;
}
function ChildRewards({ childId }: { childId: string }) {
  const wallet = useRewardsApi<StarWallet>('/rewards/wallet');
  const [prizePage, setPrizePage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const [transactionPage, setTransactionPage] = useState(1);
  const prizes = useRewardsApi<Paginated<FamilyReward>>(`/rewards?page=${prizePage}`);
  const requests = useRewardsApi<Paginated<RewardRedemption>>(
    `/rewards/redemptions?page=${requestPage}`,
  );
  const transactions = useRewardsApi<Paginated<StarTransaction>>(
    `/rewards/transactions?page=${transactionPage}`,
  );
  const [selected, setSelected] = useState<FamilyReward | null>(null);
  const [cancelling, setCancelling] = useState<RewardRedemption | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const requestKeys = useRef(new Map<string, string>());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const storageKey = (id: string) => `wonderlab:prize-request:${childId}:${id}`;
  const keyForPrize = (id: string) => {
    let key = requestKeys.current.get(id);
    if (!key) {
      try {
        key = sessionStorage.getItem(storageKey(id)) || undefined;
      } catch {
        /* Memory still preserves retries when storage is unavailable. */
      }
      key ||= crypto.randomUUID();
      requestKeys.current.set(id, key);
      try {
        sessionStorage.setItem(storageKey(id), key);
      } catch {
        /* Storage can be disabled. */
      }
    }
    return key;
  };
  const refresh = async () => {
    starsChanged();
    await Promise.all([wallet.reload(), prizes.reload(), requests.reload(), transactions.reload()]);
  };
  useEffect(() => {
    const update = () => {
      void wallet.reload();
    };
    window.addEventListener('wonderlab:stars-changed', update);
    return () => window.removeEventListener('wonderlab:stars-changed', update);
  }, [wallet.reload]);
  const redeem = async () => {
    if (!selected || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const redemption = await api<RewardRedemption>(`/rewards/${selected.id}/redeem`, {
        method: 'POST',
        body: JSON.stringify({ requestId: keyForPrize(selected.id) }),
      });
      // Only a confirmed server response completes this request key; network retries reuse it.
      requestKeys.current.delete(selected.id);
      try {
        sessionStorage.removeItem(storageKey(selected.id));
      } catch {
        /* No persisted key to clear. */
      }
      setSelected(null);
      setNotice(
        redemption.status === 'PENDING'
          ? 'Prize requested! Your parent will arrange it with you.'
          : 'This earlier request has already been resolved. No extra Stars were spent.',
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to request this prize. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (!cancelling || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/rewards/redemptions/${cancelling.id}/cancel`, { method: 'POST', body: '{}' });
      setCancelling(null);
      setNotice('Request cancelled. Your Stars are back.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to cancel this request. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  if (wallet.loading && !wallet.data) return <Loading label="Counting your Stars…" />;
  if (!wallet.data)
    return (
      <ErrorState
        message={wallet.error || 'Unable to load your Stars.'}
        retry={() => void wallet.reload()}
      />
    );
  const balance = wallet.data.balance;
  return (
    <div className="rewards-page child-rewards">
      <header className="reward-shelf-heading">
        <div>
          <h1>
            <Text text="Your little prize shelf" />
          </h1>
          <p>
            <Text text="Keep learning, collect Stars, and choose something lovely with your family." />
          </p>
        </div>
        <div className="rewards-wallet" data-testid="stars-wallet">
          <Star size={32} fill="currentColor" />
          <div>
            <strong>{balance.toLocaleString()}</strong>
            <span>
              <Text text="Stars to spend" />
            </span>
          </div>
        </div>
      </header>
      <div className="rewards-explainer">
        <Text text="Stars are for family prizes. XP still grows learning levels, and is never spent." />
      </div>
      {notice && (
        <p className="family-success" role="status">
          <Text text={notice} />
        </p>
      )}
      {error && (
        <p className="family-error" role="alert">
          <Text text={error} />
        </p>
      )}
      {wallet.error && <ErrorState message={wallet.error} retry={() => void wallet.reload()} />}
      <section className="rewards-section rewards-earning">
        <h2>
          <Text text="How to collect Stars" />
        </h2>
        <div className="rewards-rule-list">
          <p>
            <span aria-hidden="true">📖</span>
            <Text text="Complete a lesson" />
            <strong>+{wallet.data.rules.lessonStars} ★</strong>
          </p>
          <p>
            <span aria-hidden="true">💡</span>
            <Text text="Answer a quiz question correctly" />
            <strong>+{wallet.data.rules.correctAnswerStars} ★</strong>
          </p>
          <p>
            <span aria-hidden="true">🏆</span>
            <Text text="Get a perfect quiz" />
            <strong>+{wallet.data.rules.perfectQuizBonusStars} ★</strong>
          </p>
        </div>
        <p className="rewards-fineprint">
          <Text text="Each lesson and quiz earns Stars once. Replaying is practice. Your parent chooses the earning rules." />
        </p>
        <p className="rewards-fineprint">
          <Text text={`${wallet.data.pendingStars} Stars reserved for waiting requests`} /> ·{' '}
          <Text text={`${wallet.data.lifetimeEarned} Stars earned in total`} />
        </p>
      </section>
      <section className="rewards-section">
        <h2>
          <Text text="Choose a family prize" />
        </h2>
        <p>
          <Text text="Requesting a prize uses your Stars now. Your parent gives it to you later. A declined or cancelled request returns your Stars." />
        </p>
        {prizes.error && <ErrorState message={prizes.error} retry={() => void prizes.reload()} />}
        {prizes.loading && !prizes.data && <Loading label="Loading prizes…" />}
        <div className="rewards-shelf">
          {prizes.data?.data.map((prize) => (
            <article key={prize.id} className="reward-card" data-testid="child-prize-card">
              <RewardPicture prize={prize} />
              <h3>
                <Text text={prize.name} />
              </h3>
              <p>
                <Text text={prize.description} />
              </p>
              <strong className="reward-cost">
                ★ {prize.starCost.toLocaleString()} <Text text="Stars" />
              </strong>
              {balance < prize.starCost && (
                <small>
                  <Text text={`${prize.starCost - balance} more Stars to go`} />
                </small>
              )}
              <button
                className="button primary"
                disabled={busy || balance < prize.starCost || !!wallet.error || wallet.loading}
                onClick={() => {
                  setError('');
                  setSelected(prize);
                }}
              >
                <Gift size={17} />
                <Text text="Request prize" />
              </button>
            </article>
          ))}
        </div>
        {prizes.data?.data.length === 0 && (
          <div className="rewards-empty">
            <Gift size={36} />
            <h3>
              <Text text="Something lovely is on its way" />
            </h3>
            <p>
              <Text text="Ask your parent to add a family prize. Your earned Stars will be here when it is ready." />
            </p>
          </div>
        )}
        <RewardsPagination
          data={prizes.data}
          page={prizePage}
          onPage={setPrizePage}
          busy={prizes.loading}
        />
      </section>
      <section className="rewards-section rewards-paper">
        <h2>
          <Text text="My prize requests" />
        </h2>
        <p>
          <Text text="You can cancel a waiting request and get your Stars back." />
        </p>
        {requests.error && (
          <ErrorState message={requests.error} retry={() => void requests.reload()} />
        )}
        {requests.loading && !requests.data && <Loading label="Loading requests…" />}
        <div className="rewards-history">
          {requests.data?.data.map((request) => (
            <article className="reward-request" key={request.id} data-testid="child-prize-request">
              <span className="reward-history-emoji" aria-hidden="true">
                {request.emoji}
              </span>
              <div>
                <h3>{request.name}</h3>
                <p>{request.description}</p>
                <small>
                  ★ {request.starCost} · <RewardDate date={request.createdAt} />
                </small>
                <span className={'reward-status status-' + request.status.toLowerCase()}>
                  <Text text={rewardStatus[request.status]} />
                </span>
                {request.note && (
                  <p className="reward-note">
                    <Text text="Note from your parent" />: {request.note}
                  </p>
                )}
              </div>
              {request.status === 'PENDING' && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setCancelling(request);
                  }}
                >
                  <Text text="Cancel request" />
                </button>
              )}
            </article>
          ))}
        </div>
        {requests.data?.data.length === 0 && (
          <p className="rewards-empty">
            <Text text="Your first prize request will appear here." />
          </p>
        )}
        <RewardsPagination
          data={requests.data}
          page={requestPage}
          onPage={setRequestPage}
          busy={requests.loading}
        />
      </section>
      <section className="rewards-section rewards-paper">
        <h2>
          <Text text="My Star history" />
        </h2>
        {transactions.error && (
          <ErrorState message={transactions.error} retry={() => void transactions.reload()} />
        )}
        {transactions.loading && !transactions.data && <Loading label="Loading Star history…" />}
        <div className="rewards-transactions">
          {transactions.data?.data.map((transaction) => (
            <article key={transaction.id}>
              <div>
                <strong>
                  <Text
                    text={
                      transaction.kind === 'EARN'
                        ? 'Stars earned'
                        : transaction.kind === 'REFUND'
                          ? 'Stars returned'
                          : 'Prize requested'
                    }
                  />
                </strong>
                <p>
                  <Text text={transaction.reason} />
                </p>
                <small>
                  <RewardDate date={transaction.createdAt} />
                </small>
              </div>
              <strong className={transaction.amount > 0 ? 'stars-positive' : ''}>
                {transaction.amount > 0 ? '+' : ''}
                {transaction.amount} ★
              </strong>
            </article>
          ))}
        </div>
        {transactions.data?.data.length === 0 && (
          <p className="rewards-empty">
            <Text text="Complete a lesson or quiz to start your Star story." />
          </p>
        )}
        <RewardsPagination
          data={transactions.data}
          page={transactionPage}
          onPage={setTransactionPage}
          busy={transactions.loading}
        />
      </section>
      {selected && (
        <Modal
          title="Request this prize?"
          onClose={() => {
            if (!busyRef.current) setSelected(null);
          }}
        >
          <div className="rewards-confirm">
            <RewardPicture prize={selected} />
            <h3>
              <Text text={selected.name} />
            </h3>
            <p>
              <Text text={selected.description} />
            </p>
            <strong className="reward-cost">
              ★ {selected.starCost} <Text text="Stars" />
            </strong>
            <p>
              <Text text={`You’ll have ${Math.max(0, balance - selected.starCost)} Stars left.`} />
            </p>
            <p>
              <Text text="Your Stars are used now. Your parent will arrange the prize. You can cancel while it is waiting." />
            </p>
            {error && (
              <p className="family-error" role="alert">
                <Text text={error} />
              </p>
            )}
            <div className="reward-card-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                <Text text="Keep saving" />
              </button>
              <button
                className="button primary"
                data-testid="confirm-redeem"
                disabled={busy}
                onClick={() => void redeem()}
              >
                <Text text={busy ? 'Requesting…' : 'Confirm prize request'} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {cancelling && (
        <Modal
          title="Cancel this prize request?"
          onClose={() => {
            if (!busyRef.current) setCancelling(null);
          }}
        >
          <div className="rewards-confirm">
            <h3>
              {cancelling.emoji} {cancelling.name}
            </h3>
            <p>
              <Text text={`${cancelling.starCost} Stars will be returned to you.`} />
            </p>
            {error && (
              <p className="family-error" role="alert">
                <Text text={error} />
              </p>
            )}
            <div className="reward-card-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setCancelling(null)}
              >
                <Text text="Keep my request" />
              </button>
              <button className="button primary" disabled={busy} onClick={() => void cancel()}>
                <Text text={busy ? 'Saving…' : 'Cancel and return Stars'} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
