import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Home,
  Package,
  PartyPopper,
  Plug,
  Tent,
  Trophy,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Item, ItemCategory } from '../types';

export function getCategoryIcon(category: ItemCategory | string): LucideIcon {
  switch (category) {
    case 'Tools':
      return Wrench;
    case 'Electronics':
      return Plug;
    case 'Education':
      return BookOpen;
    case 'Household':
      return Home;
    case 'Outdoor':
      return Tent;
    case 'Events':
      return PartyPopper;
    case 'Sports':
      return Trophy;
    default:
      return Package;
  }
}

export function ItemImage({
  item,
  className = '',
  iconSize = 'md',
}: {
  item: { image_url?: string | null; name: string; category: ItemCategory | string };
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
}) {
  const [bad, setBad] = useState(!item.image_url);

  useEffect(() => {
    setBad(!item.image_url || !item.image_url.trim());
  }, [item.image_url]);

  const Icon = getCategoryIcon(item.category);
  const iconClass =
    iconSize === 'sm' ? 'h-8 w-8' : iconSize === 'lg' ? 'h-16 w-16' : 'h-14 w-14';

  if (bad || !item.image_url) {
    return (
      <div className={`grid place-items-center bg-[var(--sun-soft)] ${className}`}>
        <Icon className={`${iconClass} text-[var(--blue)]/70`} strokeWidth={1.75} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={item.image_url}
      alt={item.name}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setBad(true)}
      className={className}
    />
  );
}

interface ItemThumbnailProps {
  imageUrl?: string | null;
  name: string;
  category: ItemCategory | string;
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
}

export function ItemThumbnail({
  imageUrl,
  name,
  category,
  className = '',
  iconSize = 'md',
}: ItemThumbnailProps) {
  return (
    <div
      className={`relative aspect-[4/3] w-full overflow-hidden bg-[var(--sun-soft)] flex items-center justify-center ${className}`}
    >
      <ItemImage
        item={{ image_url: imageUrl ?? null, name, category }}
        iconSize={iconSize}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
