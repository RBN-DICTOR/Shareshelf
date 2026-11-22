import React, { useEffect, useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, Paintbrush, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useShareShelfData } from '../hooks/useShareShelfData';
import { uploadItemImage } from '../lib/api';
import { cleanText, mapSupabaseError } from '../lib/format';
import { isValidStoredImageSource } from '../lib/itemImages';
import {
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
  type Item,
  type ItemCategory,
  type ItemCondition,
} from '../types';
import { Button } from './Button';
import { Modal } from './Modal';
import { PngCreator } from './PngCreator';

interface ShareItemModalProps {
  open: boolean;
  onClose: () => void;
  editingItem?: Item | null;
  onSaved?: (item: Item) => void;
}

export function ShareItemModal({
  open,
  onClose,
  editingItem = null,
  onSaved,
}: ShareItemModalProps) {
  const { user, profile } = useAuth();
  const { addItem, editItem } = useShareShelfData();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ItemCategory>('Tools');
  const [condition, setCondition] = useState<ItemCondition>('Good');
  const [neighborhood, setNeighborhood] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [rules, setRules] = useState(
    'Please return it on time and in the condition you received it.'
  );
  const [replacementValue, setReplacementValue] = useState('40');
  const [imageUrl, setImageUrl] = useState('');
  const [imageMode, setImageMode] = useState<'upload' | 'create'>('upload');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setSubmitError(null);
    setImageMode('upload');
    if (editingItem) {
      setName(editingItem.name);
      setDescription(editingItem.description);
      setCategory(editingItem.category);
      setCondition(editingItem.condition);
      setNeighborhood(editingItem.neighborhood);
      setIsAvailable(editingItem.is_available);
      setRules(
        editingItem.rules ||
          'Please return it on time and in the condition you received it.'
      );
      setReplacementValue(String(editingItem.replacement_value ?? 0));
      setImageUrl(editingItem.image_url || '');
    } else {
      setName('');
      setDescription('');
      setCategory('Tools');
      setCondition('Good');
      setNeighborhood(profile?.neighborhood || '');
      setIsAvailable(true);
      setRules('Please return it on time and in the condition you received it.');
      setReplacementValue('40');
      setImageUrl('');
    }
  }, [open, editingItem, profile?.neighborhood]);

  const handleFileUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith('image/')) {
      setFieldErrors((prev) => ({
        ...prev,
        image: 'Please select an image file (PNG, JPG, WebP, or GIF).',
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, image: 'Please choose an image smaller than 5 MB.' }));
      return;
    }
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
    setUploadingImage(true);
    try {
      const storedImage = await uploadItemImage(file, user.id);
      setImageUrl(storedImage);
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, image: mapSupabaseError(err) }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleFileUpload(file);
          return;
        }
      }
    }
  };

  const handleDownloadPreview = () => {
    if (!imageUrl) return;
    const safeSlug =
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'shareshelf-item';
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${safeSlug}.png`;
    a.click();
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!cleanText(name)) errors.name = 'Give your item a short, clear name.';
    if (!cleanText(description) || cleanText(description).length < 8) {
      errors.description = 'Add a short description (at least 8 characters).';
    }
    if (!cleanText(neighborhood)) {
      errors.neighborhood = 'Enter the neighborhood for pickup.';
    }
    const val = Number(replacementValue);
    if (Number.isNaN(val) || val < 0) {
      errors.replacementValue = 'Enter 0 or a positive dollar amount.';
    }
    if (imageUrl.trim() && !isValidStoredImageSource(imageUrl)) {
      errors.image = 'Please upload or create a PNG, JPG, or WebP image file.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!user) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name: cleanText(name),
        description: cleanText(description),
        category,
        condition,
        image_url: imageUrl.trim() || null,
        neighborhood: cleanText(neighborhood),
        is_available: isAvailable,
        rules:
          cleanText(rules) ||
          'Please return it on time and in the condition you received it.',
        replacement_value: Math.max(0, Number(replacementValue) || 0),
      };

      const saved = editingItem
        ? await editItem(editingItem.id, payload)
        : await addItem({ owner_id: user.id, ...payload });

      onSaved?.(saved);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save this item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingItem ? 'Edit item' : 'Share an item'}
      maxWidthClass="max-w-2xl"
    >
      <form
        onSubmit={handleSubmit}
        onPaste={handlePasteImage}
        className="space-y-5 p-5 sm:p-6"
        noValidate
      >
        {/* Photo upload or PNG creation */}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-bold text-[var(--navy)]">
              Item image (PNG or photo)
            </label>
            {!imageUrl && (
              <div
                role="tablist"
                aria-label="Item image source"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={imageMode === 'upload'}
                  onClick={() => setImageMode('upload')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                    imageMode === 'upload'
                      ? 'bg-[var(--blue)] text-white'
                      : 'text-[var(--navy)] hover:bg-[var(--sun-soft)]'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Upload image
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={imageMode === 'create'}
                  onClick={() => setImageMode('create')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                    imageMode === 'create'
                      ? 'bg-[var(--blue)] text-white'
                      : 'text-[var(--navy)] hover:bg-[var(--sun-soft)]'
                  }`}
                >
                  <Paintbrush className="h-3.5 w-3.5" aria-hidden="true" />
                  Create PNG
                </button>
              </div>
            )}
          </div>

          {imageUrl ? (
            <div className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--sun-soft)]">
              <img
                src={imageUrl}
                alt={name || 'Uploaded item preview'}
                referrerPolicy="no-referrer"
                className="aspect-[4/3] max-h-64 w-full object-cover"
              />
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {imageUrl.startsWith('data:image/') && (
                  <button
                    type="button"
                    onClick={handleDownloadPreview}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/95 px-3 py-1.5 text-xs font-bold text-[var(--navy)] shadow-sm hover:bg-[var(--sun-soft)]"
                  >
                    <Download className="h-3.5 w-3.5 text-[var(--blue)]" aria-hidden="true" />
                    Save PNG
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--danger)]/30 bg-white/95 px-3 py-1.5 text-xs font-bold text-[var(--danger)] shadow-sm hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove photo
                </button>
              </div>
            </div>
          ) : imageMode === 'create' ? (
            <PngCreator
              itemName={name}
              category={category}
              disabled={uploadingImage}
              onAttachPng={handleFileUpload}
            />
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFileUpload(file);
              }}
              className={`flex flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
                dragActive
                  ? 'border-[var(--blue)] bg-[var(--blue-soft)]/50'
                  : 'border-[var(--line)] bg-white hover:border-[var(--blue)]/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sun-soft)] text-[var(--blue)]">
                {uploadingImage ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <ImagePlus className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
              <p className="text-sm font-bold text-[var(--navy)]">
                {uploadingImage
                  ? 'Processing image...'
                  : 'Drop a PNG or photo here, paste an image, or choose from device'}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--muted)]">
                Accepts real PNG, JPG, or WebP files — or switch to Create PNG to draw your own.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-bold text-[var(--navy)] hover:bg-[var(--sun-soft)]"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Choose PNG or photo
                </button>
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => setImageMode('create')}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--blue)]/25 bg-[var(--blue-soft)] px-4 py-2 text-xs font-bold text-[var(--blue)] hover:bg-[var(--blue)] hover:text-white"
                >
                  <Paintbrush className="h-3.5 w-3.5" aria-hidden="true" />
                  Create a PNG image
                </button>
              </div>
            </div>
          )}

          {fieldErrors.image && (
            <p className="mt-1.5 text-xs font-semibold text-[var(--danger)]">
              {fieldErrors.image}
            </p>
          )}
        </div>

        {/* Name */}
        <div>
          <label htmlFor="item-name" className="mb-1 block text-sm font-bold text-[var(--navy)]">
            Item name
          </label>
          <input
            id="item-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Cordless power drill"
            className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none"
            required
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{fieldErrors.name}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="item-desc" className="mb-1 block text-sm font-bold text-[var(--navy)]">
            Description
          </label>
          <textarea
            id="item-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share what's included, size, or anything helpful to know before borrowing."
            className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none"
            required
          />
          {fieldErrors.description && (
            <p className="mt-1 text-xs font-semibold text-[var(--danger)]">
              {fieldErrors.description}
            </p>
          )}
        </div>

        {/* Category & Condition */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="item-category"
              className="mb-1 block text-sm font-bold text-[var(--navy)]"
            >
              Category
            </label>
            <select
              id="item-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ItemCategory)}
              className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
            >
              {ITEM_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="item-condition"
              className="mb-1 block text-sm font-bold text-[var(--navy)]"
            >
              Condition
            </label>
            <select
              id="item-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as ItemCondition)}
              className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] focus:border-[var(--blue)] focus:outline-none"
            >
              {ITEM_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Neighborhood & Replacement value */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="item-neighborhood"
              className="mb-1 block text-sm font-bold text-[var(--navy)]"
            >
              Neighborhood
            </label>
            <input
              id="item-neighborhood"
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="e.g., Riverside"
              className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none"
              required
            />
            {fieldErrors.neighborhood && (
              <p className="mt-1 text-xs font-semibold text-[var(--danger)]">
                {fieldErrors.neighborhood}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="item-value" className="mb-1 block text-sm font-bold text-[var(--navy)]">
              Estimated replacement value (USD)
            </label>
            <input
              id="item-value"
              type="number"
              min="0"
              step="1"
              value={replacementValue}
              onChange={(e) => setReplacementValue(e.target.value)}
              className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] tabular-nums focus:border-[var(--blue)] focus:outline-none"
            />
            <p className="mt-1 text-xs font-medium text-[var(--muted)]">
              Used to estimate how much the community saves
            </p>
            {fieldErrors.replacementValue && (
              <p className="mt-1 text-xs font-semibold text-[var(--danger)]">
                {fieldErrors.replacementValue}
              </p>
            )}
          </div>
        </div>

        {/* Borrowing instructions */}
        <div>
          <label htmlFor="item-rules" className="mb-1 block text-sm font-bold text-[var(--navy)]">
            Borrowing instructions
          </label>
          <textarea
            id="item-rules"
            rows={2}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Pickup notes, care tips, or return expectations..."
            className="w-full rounded-[14px] border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--navy)] placeholder:text-[var(--muted)]/70 focus:border-[var(--blue)] focus:outline-none"
          />
        </div>

        {/* Availability toggle */}
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
          <div>
            <span className="block text-sm font-bold text-[var(--navy)]">
              Available to borrow
            </span>
            <span className="block text-xs font-medium text-[var(--muted)]">
              Turn off anytime if you are using this item yourself
            </span>
          </div>
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
            className="h-5 w-5 rounded accent-[var(--blue)]"
          />
        </label>

        {submitError && (
          <div
            role="alert"
            className="rounded-[14px] border border-[var(--danger)]/30 bg-red-50 px-4 py-3 text-sm font-semibold text-[var(--danger)]"
          >
            {submitError}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2.5 pt-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="orange"
            loading={saving}
            disabled={uploadingImage}
          >
            {editingItem ? 'Save changes' : 'Share an item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
