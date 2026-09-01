import React, { useState } from 'react';
import {
  Heart, Plus, Trash2, Check, CalendarHeart, Gift, StickyNote,
  ShieldCheck, Archive, Loader2,
} from 'lucide-react';
import {
  Card, CardContent, Button, Input, Select, Textarea, Label, Badge,
  EmptyState, Skeleton, BackendError, Switch, ConfirmDialog, useToast,
} from '../components/UI';
import { useCompanion } from '../hooks/useCompanion';
import * as api from '../services/companionApi';
import type { PartnerNote, PartnerNoteKind, Partner } from '../types';

const Section = ({ title, hint, children, action }: {
  title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode;
}) => (
  <section className="mb-10">
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/40">{title}</h2>
        {hint && <p className="text-[12px] font-medium text-foreground/45 mt-1.5 max-w-lg leading-relaxed">{hint}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

// ── Notes: the one-tap capture that makes the app compound ────────────────
const NotesBlock = ({ partnerId, onChanged }: { partnerId: string; onChanged: () => void }) => {
  const [notes, setNotes] = useState<PartnerNote[] | null>(null);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<PartnerNoteKind>('fact');
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  React.useEffect(() => {
    api.listNotes(partnerId).then(setNotes).catch(() => setNotes([]));
  }, [partnerId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const created = await api.addNote(partnerId, body, kind);
      setNotes(prev => [created, ...(prev ?? [])]);
      setBody('');
      onChanged();
    } catch (err: any) {
      addToast(err?.message || 'Could not save that note.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const prev = notes;
    setNotes(n => (n ?? []).filter(x => x.id !== id));
    try {
      await api.deleteNote(id);
    } catch (err: any) {
      setNotes(prev ?? []);
      addToast(err?.message || 'Could not delete that.', 'error');
    }
  };

  const kindLabel: Record<PartnerNoteKind, string> = {
    fact: 'Fact', wish: 'Wants', moment: 'Moment',
  };

  return (
    <>
      <Card className="p-5 mb-4">
        <form onSubmit={add} className="space-y-3">
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="They mentioned they liked the green earrings at Mlimani…"
            maxLength={500}
            className="min-h-[80px]"
          />
          <div className="flex gap-3">
            <Select value={kind} onChange={e => setKind(e.target.value as PartnerNoteKind)} className="h-12 max-w-[160px]">
              <option value="fact">Fact</option>
              <option value="wish">Wants</option>
              <option value="moment">Moment</option>
            </Select>
            <Button type="submit" size="default" className="h-12" isLoading={saving} disabled={!body.trim()}>
              <Plus className="w-4 h-4 mr-1.5" /> Save
            </Button>
          </div>
        </form>
      </Card>

      {notes === null ? (
        <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
      ) : notes.length === 0 ? (
        <Card>
          <EmptyState
            icon={StickyNote}
            title="Nothing saved yet"
            subtitle="Add things as they come up in conversation. In six months this is the most valuable thing in the app."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {notes.map(n => (
            <Card key={n.id} className="p-4">
              <div className="flex items-start gap-3">
                <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">{kindLabel[n.kind]}</Badge>
                <p className="text-[13px] font-medium text-foreground/70 flex-1 leading-relaxed">{n.body}</p>
                <button
                  onClick={() => remove(n.id)}
                  aria-label="Delete note"
                  className="text-foreground/25 hover:text-red-500 transition-colors shrink-0 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export const PartnerPage = () => {
  const { partner, occasions, promises, isLoading, error, reload, hasPartner } = useCompanion();
  const { addToast } = useToast();
  const [draft, setDraft] = useState<Partial<Partner>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [confirm, setConfirm] = useState<null | 'archive' | 'delete'>(null);
  const [busy, setBusy] = useState(false);

  // Occasion form
  const [occTitle, setOccTitle] = useState('');
  const [occDate, setOccDate] = useState('');
  const [occAnnual, setOccAnnual] = useState(true);

  // Promise form
  const [promiseBody, setPromiseBody] = useState('');

  React.useEffect(() => { if (partner) setDraft(partner); }, [partner]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        <Skeleton className="h-10 w-56 mb-8" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error) return <BackendError message={error} onRetry={reload} />;
  if (!hasPartner || !partner) {
    return (
      <div className="max-w-md mx-auto py-20 px-4">
        <Card>
          <EmptyState
            icon={Heart}
            title="No partner set up yet"
            subtitle="Head back to the companion home to get started."
            action={<Button asChild><a href="/companion">Go to companion</a></Button>}
          />
        </Card>
      </div>
    );
  }

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.updatePartner(partner.id, draft);
      addToast('Saved.', 'success');
      await reload();
    } catch (err: any) {
      addToast(err?.message || 'Could not save.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const addOccasion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occTitle.trim() || !occDate) return;
    try {
      await api.addOccasion(partner.id, {
        title: occTitle, occasion_date: occDate, is_annual: occAnnual,
        lead_days: occAnnual ? 14 : 3,
      });
      setOccTitle(''); setOccDate('');
      await reload();
    } catch (err: any) {
      addToast(err?.message || 'Could not add that.', 'error');
    }
  };

  const addPromise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promiseBody.trim()) return;
    try {
      await api.addPromise(partner.id, promiseBody);
      setPromiseBody('');
      await reload();
    } catch (err: any) {
      addToast(err?.message || 'Could not add that.', 'error');
    }
  };

  const runDestructive = async () => {
    setBusy(true);
    try {
      if (confirm === 'archive') await api.archivePartner(partner.id);
      if (confirm === 'delete') await api.deletePartnerForever(partner.id);
      setConfirm(null);
      addToast(confirm === 'delete' ? 'Deleted. All of it.' : 'Archived.', 'success');
      await reload();
    } catch (err: any) {
      addToast(err?.message || 'Could not complete that.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof Partner, label: string, placeholder: string) => (
    <div>
      <Label htmlFor={`f-${key}`}>{label}</Label>
      <Input
        id={`f-${key}`}
        value={(draft[key] as string) ?? ''}
        onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
          {partner.display_name}
        </h1>
        <p className="text-sm font-medium text-foreground/50 mt-2">
          Everything here is private to you.
        </p>
      </header>

      <Section
        title="What you know"
        hint="The more that's here, the more specific every suggestion gets. Fill it in over time — you don't need it all now."
      >
        <Card className="p-5 space-y-4">
          {field('display_name', 'Name', 'Their name')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="f-birthday">Birthday</Label>
              <Input
                id="f-birthday" type="date"
                value={draft.birthday ?? ''}
                onChange={e => setDraft(d => ({ ...d, birthday: e.target.value || null }))}
              />
            </div>
            <div>
              <Label htmlFor="f-anniversary">Anniversary</Label>
              <Input
                id="f-anniversary" type="date"
                value={draft.anniversary ?? ''}
                onChange={e => setDraft(d => ({ ...d, anniversary: e.target.value || null }))}
              />
            </div>
          </div>
          {field('loves', 'Loves', 'Flowers, seafood, long drives…')}
          {field('avoids', 'Avoids', 'Crowds, surprises, spicy food…')}
          {field('allergies', 'Allergies', 'Checked before every gift suggestion')}
          {field('sizes', 'Sizes', 'Clothes, shoes, ring')}
          <Button onClick={saveProfile} isLoading={savingProfile}>Save</Button>
        </Card>
      </Section>

      <Section
        title="Rituals"
        hint="Off by default. Turn on only what you actually want a tap on the shoulder for — and skipping one never counts against you."
      >
        <Card className="p-5 space-y-4">
          {([
            ['ritual_morning', 'Morning message', 'A nudge before noon.'],
            ['ritual_evening', 'Evening check-in', 'A nudge after 7pm to ask how their day went.'],
          ] as const).map(([key, label, sub]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground">{label}</p>
                <p className="text-[12px] font-medium text-foreground/45 mt-0.5">{sub}</p>
              </div>
              <Switch
                checked={!!draft[key]}
                onCheckedChange={v => setDraft(d => ({ ...d, [key]: v }))}
              />
            </div>
          ))}
          <div className="pt-2">
            <Label htmlFor="cadence">Remind me to plan a date every</Label>
            <Select
              id="cadence"
              value={String(draft.date_cadence_days ?? 14)}
              onChange={e => setDraft(d => ({ ...d, date_cadence_days: Number(e.target.value) }))}
            >
              <option value="7">Week</option>
              <option value="14">Two weeks</option>
              <option value="30">Month</option>
              <option value="60">Two months</option>
            </Select>
          </div>
          <Button onClick={saveProfile} isLoading={savingProfile}>Save rituals</Button>
        </Card>
      </Section>

      <Section
        title="Dates that matter"
        hint="Birthdays and anniversaries, yes — but the ones that count most are the hard days. Their exam, their interview, the anniversary of a loss."
      >
        <Card className="p-5 mb-4">
          <form onSubmit={addOccasion} className="space-y-3">
            <Input
              value={occTitle} onChange={e => setOccTitle(e.target.value)}
              placeholder="Their job interview" maxLength={80}
            />
            <div className="flex flex-col sm:flex-row gap-3">
              <Input type="date" value={occDate} onChange={e => setOccDate(e.target.value)} />
              <div className="flex items-center gap-3 shrink-0 px-1">
                <Switch checked={occAnnual} onCheckedChange={setOccAnnual} />
                <span className="text-xs font-bold text-foreground/60">Every year</span>
              </div>
              <Button type="submit" className="h-14 shrink-0" disabled={!occTitle.trim() || !occDate}>
                <Plus className="w-4 h-4 mr-1.5" /> Add
              </Button>
            </div>
          </form>
        </Card>

        {occasions.length === 0 ? (
          <Card><EmptyState icon={CalendarHeart} title="No dates saved" subtitle="Add their birthday to start." /></Card>
        ) : (
          <div className="space-y-2">
            {occasions.map(o => (
              <Card key={o.id} className="p-4 flex items-center gap-3">
                <CalendarHeart className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{o.title}</p>
                  <p className="text-[12px] font-medium text-foreground/45">
                    {o.occasion_date}{o.is_annual && ' · every year'}
                  </p>
                </div>
                <button
                  onClick={async () => { await api.deleteOccasion(o.id); await reload(); }}
                  aria-label={`Delete ${o.title}`}
                  className="text-foreground/25 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Things you said you'd do"
        hint="The quiet relationship killer. Park it here and it'll come back to you once a week — not every morning."
      >
        <Card className="p-5 mb-4">
          <form onSubmit={addPromise} className="flex gap-3">
            <Input
              value={promiseBody} onChange={e => setPromiseBody(e.target.value)}
              placeholder="Take them to Bagamoyo" maxLength={300}
            />
            <Button type="submit" className="h-14 shrink-0" disabled={!promiseBody.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </form>
        </Card>

        {promises.length === 0 ? (
          <Card><EmptyState icon={Gift} title="Nothing outstanding" subtitle="Add something the moment you say it out loud." /></Card>
        ) : (
          <div className="space-y-2">
            {promises.map(p => (
              <Card key={p.id} className="p-4 flex items-center gap-3">
                <p className="text-sm font-medium text-foreground/70 flex-1">{p.body}</p>
                <Button
                  size="sm" variant="secondary"
                  onClick={async () => { await api.completePromise(p.id); await reload(); }}
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" /> Did it
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Notes"
        hint="Anything they mention. Saved in one tap, surfaced when it's useful."
      >
        <NotesBlock partnerId={partner.id} onChanged={reload} />
      </Section>

      {/* Breakups are a designed flow, not an edge case. Archive keeps the
          history; delete genuinely removes everything, no soft-delete. */}
      <Section title="If things change" hint="Your data, your call. Neither option asks you to explain yourself.">
        <Card className="p-5 space-y-3">
          <Button variant="secondary" className="w-full" onClick={() => setConfirm('archive')}>
            <Archive className="w-4 h-4 mr-2" /> Archive {partner.display_name}
          </Button>
          <Button variant="danger" className="w-full" onClick={() => setConfirm('delete')}>
            <Trash2 className="w-4 h-4 mr-2" /> Delete everything, permanently
          </Button>
          <p className="text-[11px] text-foreground/40 leading-relaxed flex items-start gap-2 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Deleting removes the profile, every note, occasion, promise and logged
            date. It cannot be undone and nothing is kept on our side.
          </p>
        </Card>
      </Section>

      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm === 'delete' ? 'Delete everything?' : `Archive ${partner.display_name}?`}
        message={confirm === 'delete'
          ? 'Every note, date and reminder goes with it. This cannot be undone.'
          : 'The history is kept but nothing will be suggested anymore. You can start fresh with someone new.'}
        confirmText={confirm === 'delete' ? 'Delete forever' : 'Archive'}
        isDangerous={confirm === 'delete'}
        isLoading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={runDestructive}
      />
    </div>
  );
};
