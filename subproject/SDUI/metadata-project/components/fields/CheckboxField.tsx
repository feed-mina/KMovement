'use client';

import React, { memo } from 'react';
import { cn } from "@/components/utils/cn";
import { normalizeDisplayText } from "@/components/utils/displayText";

const CheckboxField = memo(({ id, meta, data, onChange }: any) => {
    const targetKey = meta?.ref_data_id || meta?.refDataId || id;
    const checked = typeof data === 'boolean' ? data :
                    typeof data === 'string' ? data === 'true' :
                    (data?.[targetKey] === true || data?.[targetKey] === 'true');

    const isReadOnly = meta?.isReadonly === true || meta?.isReadonly === "true" ||
        meta?.is_readonly === true || meta?.is_readonly === "true";

    const label = normalizeDisplayText(meta?.labelText || meta?.label_text || '');

    const containerClass = cn(
        "checkbox-field-container",
        meta?.css_class,
        meta?.cssClass
    );

    return (
        <div className={containerClass}>
            <label className="checkbox-label">
                <input
                    type="checkbox"
                    id={id}
                    checked={checked}
                    disabled={isReadOnly}
                    onChange={(e) => onChange?.(targetKey, e.target.checked)}
                    className="checkbox-input"
                />
                <span className="checkbox-text">{label}</span>
            </label>
        </div>
    );
});

CheckboxField.displayName = "CheckboxField";
export default CheckboxField;
