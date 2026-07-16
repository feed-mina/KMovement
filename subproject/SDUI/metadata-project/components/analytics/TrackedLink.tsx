'use client';

import Link, { type LinkProps } from 'next/link';
import type { AnchorHTMLAttributes } from 'react';
import { trackEvent } from '@/lib/analytics/dataLayer';

type Props = LinkProps & AnchorHTMLAttributes<HTMLAnchorElement> & { entryPoint: string };

export default function TrackedLink({ entryPoint, onClick, ...props }: Props) {
    return (
        <Link
            {...props}
            onClick={(event) => {
                trackEvent('itinerary_start', { entry_point: entryPoint });
                onClick?.(event);
            }}
        />
    );
}
