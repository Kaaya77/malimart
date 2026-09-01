import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Eye, EyeOff, Pencil, MapPin } from 'lucide-react';
import {
  Card, Button, Input, Select, Textarea, Label, Badge,
  EmptyState, Skeleton, BackendError, Modal, ConfirmDialog, useToast,
} from '../components/UI';
import * as api from '../services/companionApi';
import type { CuratedSpot, SpotCategory } from '../types';

const CATEGORIES: SpotCategory[] = [
  'restaurant', 'breakfast', 'sunset', 'nightlife', 'beach', 'activity', 'gift', 'movie', 'event',
];

type Draft = Partial<CuratedSpot> & { title: string; category: SpotCategory; why: string };

const blank = (): Draft => ({
  title: '', category: 'restaurant', why: '', city: 'Dar es Salaam',
  area: '', price_min: null, price_max: null, tags: [], sort_weight: 0, is_active: false,
});

export const AdminCurationPage = () => {
  const [spots, setSpots] = useState<CuratedSpot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CuratedSpot | null>(null);
  const { addToast } = useToast();

  const load = useCallback(async () => {
    setError(null);
    try {
      setSpots(await api.adminListSpots());
    } catch (e: any) {
      setError(e?.message || 'Could not load the curation list.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing || saving) return;
    if (!editing.title.trim() || editing.why.trim().length < 10) {
      addToast('A spot needs a title and at least a sentence of "why".', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingId) await api.adminUpdateSpot(editingId, editing);
      else await api.adminCreateSpot(editing);
      addToast('Saved.', 'success');
      setEditing(null); setEditingId(null);
      await load();
    } catch (e: any) {
      addToast(e?.message || 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (spot: CuratedSpot) => {
    try {
      await api.adminUpdateSpot(spot.id, { is_active: !spot.is_active });
      await load();
    } catch (e: any) {
      addToast(e?.message || 'Could not update.', 'error');
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.adminDeleteSpot(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      addToast(e?.message || 'Could not delete.', 'error');
    }
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setEditing(d => (d ? { ...d, [key]: value } : d));

  const liveCount = spots?.filter(s => s.is_active).length ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <header className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Curation</h1>
          <p className="text-sm font-medium text-foreground/50 mt-2">
            {liveCount} live · {(spots?.length ?? 0) - liveCount} draft
          </p>
        </div>
        <Button onClick={() => { setEditing(blank()); setEditingId(null); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add
        </Button>
      </header>

      <Card className="p-4 mb-6 border-l-4 border-l-amber-500">
        <p className="text-[12px] font-medium text-foreground/60 leading-relaxed">
          <strong className="text-foreground">Nothing goes live until you flip it.</strong>{' '}
          New spots and the seeded examples start as drafts. Verify the place is
          open, the price band is right, and that the "why" reads like advice
          from someone who's actually been — then publish. A short accurate list
          beats a long stale one.
        </p>
      </Card>

      {error ? (
        <BackendError message={error} onRetry={load} />
      ) : spots === null ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : spots.length === 0 ? (
        <Card>
          <EmptyState
            icon={MapPin}
            title="No spots yet"
            subtitle="Add the first place you'd genuinely send a friend to."
            action={<Button onClick={() => { setEditing(blank()); setEditingId(null); }}>Add a spot</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {spots.map(s => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-black text-foreground">{s.title}</h3>
                    <Badge variant={s.is_active ? 'success' : 'secondary'} className="text-[10px]">
                      {s.is_active ? 'Live' : 'Draft'}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                  </div>
                  <p className="text-[12px] font-medium text-foreground/50 line-clamp-2 leading-relaxed">{s.why}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(s)}
                    aria-label={s.is_active ? `Unpublish ${s.title}` : `Publish ${s.title}`}
                    className="p-2 text-foreground/40 hover:text-foreground transition-colors"
                  >
                    {s.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditing({ ...s }); setEditingId(s.id); }}
                    aria-label={`Edit ${s.title}`}
                    className="p-2 text-foreground/40 hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(s)}
                    aria-label={`Delete ${s.title}`}
                    className="p-2 text-foreground/40 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={editing !== null}
        title={editingId ? 'Edit spot' : 'New spot'}
        onClose={() => { setEditing(null); setEditingId(null); }}
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="c-title">Name</Label>
              <Input id="c-title" value={editing.title} onChange={e => set('title', e.target.value)} maxLength={120} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-cat">Category</Label>
                <Select id="c-cat" value={editing.category} onChange={e => set('category', e.target.value as SpotCategory)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="c-area">Area</Label>
                <Input id="c-area" value={editing.area ?? ''} onChange={e => set('area', e.target.value)} placeholder="Masaki" />
              </div>
            </div>

            <div>
              <Label htmlFor="c-why">Why go — the actual advice</Label>
              <Textarea
                id="c-why"
                value={editing.why}
                onChange={e => set('why', e.target.value)}
                maxLength={600}
                placeholder="Go at 6 for the terrace. Skip the pasta. Around 90k for two. Not a first-date place — take someone you already like."
              />
              <p className="text-[11px] text-foreground/40 mt-2">
                This is the only thing that makes the app worth opening. Write it
                like you're texting a friend, not writing a listing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="c-min">Price from (TZS)</Label>
                <Input
                  id="c-min" type="number" min={0}
                  value={editing.price_min ?? ''}
                  onChange={e => set('price_min', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="c-max">Price to (TZS)</Label>
                <Input
                  id="c-max" type="number" min={0}
                  value={editing.price_max ?? ''}
                  onChange={e => set('price_max', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="c-tags">Tags (comma separated)</Label>
              <Input
                id="c-tags"
                value={(editing.tags ?? []).join(', ')}
                onChange={e => set('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                placeholder="cheap, outdoors, first-date"
              />
            </div>

            <div>
              <Label htmlFor="c-maps">Maps link</Label>
              <Input
                id="c-maps" value={editing.maps_url ?? ''}
                onChange={e => set('maps_url', e.target.value || null)}
                placeholder="https://…"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button className="flex-1" onClick={save} isLoading={saving}>Save as draft</Button>
              <Button
                variant="secondary" className="flex-1"
                onClick={() => { set('is_active', true); setTimeout(save, 0); }}
                isLoading={saving}
              >
                Save & publish
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={`Delete ${confirmDelete?.title ?? ''}?`}
        message="This removes the spot entirely. Any logged dates that referenced it keep their title."
        confirmText="Delete"
        isDangerous
        onCancel={() => setConfirmDelete(null)}
        onConfirm={doDelete}
      />
    </div>
  );
};
