'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Check, Eye, ArrowUpRight, Palette, LoaderCircle } from 'lucide-react';
import { appearanceSchema, type PortalAppearance, type PortalTemplate } from '@wonderlab/shared';
import { portalTemplates, templateOrder } from '@/lib/templates';
import { api } from '@/lib/api';
import { useApi, Loading, ErrorState } from './ui';

export function AdminAppearance() {
  const { data, error, loading, reload, setData } = useApi<PortalAppearance>('/admin/appearance');
  const [selected, setSelected] = useState<PortalTemplate>('playground');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    if (data) setSelected(data.template);
  }, [data]);
  if (loading && !data) return <Loading label="Loading student templates…" />;
  if (error || !data) return <ErrorState message={error} retry={() => void reload()} />;
  return (
    <form
      className="admin-panel admin-appearance"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setNotice('');
        setSaveError('');
        try {
          const saved = appearanceSchema.parse(
            await api('/admin/appearance', {
              method: 'PATCH',
              body: JSON.stringify({ template: selected }),
            }),
          );
          setData(saved);
          setNotice(`${portalTemplates[saved.template].name} is now the student portal template.`);
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : 'Unable to save the template.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="appearance-heading">
        <div>
          <h2>
            <Palette size={20} /> Student portal template
          </h2>
          <p>Choose a learning world for every student. Preview before applying.</p>
        </div>
        <span className="appearance-active">Current: {portalTemplates[data.template].name}</span>
      </div>
      <fieldset disabled={busy}>
        <legend>Choose a template</legend>
        <div className="template-options">
          {templateOrder.map((id) => {
            const design = portalTemplates[id];
            return (
              <article
                className={'template-option ' + (selected === id ? 'selected' : '')}
                key={id}
              >
                <label className="template-choice">
                  <Image
                    src={design.previewAsset}
                    alt={`${design.name} design reference`}
                    width={1600}
                    height={1000}
                    sizes="(max-width: 760px) 90vw, (max-width: 1200px) 45vw, 30vw"
                  />
                  <span className="template-choice-title">
                    <input
                      type="radio"
                      aria-label={design.name}
                      name="portal-template"
                      value={id}
                      checked={selected === id}
                      onChange={() => {
                        setSelected(id);
                        setNotice('');
                      }}
                    />
                    <strong>{design.name}</strong>
                    {data.template === id && <span className="template-applied">Applied</span>}
                  </span>
                  <span className="template-description">{design.description}</span>
                  <span className="template-swatches" aria-hidden="true">
                    {design.colors.map((color) => (
                      <i key={color} style={{ backgroundColor: color }} />
                    ))}
                  </span>
                </label>
                <Link
                  href={`/app?previewTemplate=${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="template-preview-link"
                  aria-label={`Preview ${design.name}`}
                >
                  <Eye size={16} /> Preview student portal <ArrowUpRight size={15} />
                </Link>
              </article>
            );
          })}
        </div>
      </fieldset>
      <p className="appearance-scope">
        This sets the shared student template. Lessons, scores and progress stay the same. Existing
        student tabs update when reopened or within a minute.
      </p>
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      {saveError && (
        <p className="inline-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="appearance-actions">
        <button className="button primary" disabled={busy || selected === data.template}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}Apply student
          template
        </button>
        <Link className="button secondary" href="/app" target="_blank" rel="noopener noreferrer">
          Open student portal <ArrowUpRight size={15} />
        </Link>
      </div>
    </form>
  );
}
