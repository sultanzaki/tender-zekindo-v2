"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";

import type {
  SelectOptionsMap,
  TenderFormValues,
  TenderEditFormValues,
} from "@/lib/types";
import { RESULT_ENUM, TRACK_LABELS, TRACKS } from "@/lib/types";
import { OptionSelect } from "./OptionSelect";
import { NumberInput } from "./NumberInput";
import styles from "./NewTenderForm.module.css";
export function TenderFields({
  section,
  values,
  onChange,
  options,
  allowTrack = false,
  duplicate = false,
}: {
  section: "details" | "value" | "outcome";
  values: TenderFormValues | TenderEditFormValues;
  onChange: (patch: Partial<TenderEditFormValues>) => void;
  options: SelectOptionsMap;
  allowTrack?: boolean;
  duplicate?: boolean;
}) {
  if (section === "details")
    return (
      <div className={styles.fieldColumn}>
        {allowTrack && (
          <fieldset className={styles.trackPicker}>
            <legend>Business track</legend>
            {TRACKS.map((track) => (
              <Button
                variant="ghost"
                key={track}
                type="button"
                aria-pressed={values.track === track}
                onClick={() => onChange({ track })}
              >
                {TRACK_LABELS[track]}
              </Button>
            ))}
            <p className="muted">
              Track determines the milestone catalog and cannot change after
              creation.
            </p>
          </fieldset>
        )}
        <div className={styles.fieldRow2}>
          <Label className={styles.label}>
            Area *
            <OptionSelect
              field="area"
              label="Area"
              className={styles.input}
              value={values.area}
              options={options.area}
              required
              onChange={(area) => onChange({ area })}
            />
          </Label>
          <Label className={styles.label}>
            Customer *
            <OptionSelect
              field="customer"
              label="Customer"
              className={styles.input}
              value={values.customer}
              options={options.customer}
              required
              onChange={(customer) => onChange({ customer })}
            />
          </Label>
        </div>
        <Label className={styles.label}>
          Tender number
          <Input
            className={styles.input}
            value={values.tenderNo}
            onChange={(e) => onChange({ tenderNo: e.target.value })}
            placeholder="Tender reference number"
          />
          {duplicate && (
            <span className={styles.fieldWarning}>
              This reference is already used by another tender. Check before
              saving.
            </span>
          )}
        </Label>
        <Label className={styles.label}>
          Package title
          <Textarea
            className={styles.textarea}
            rows={4}
            value={values.product}
            onChange={(e) => onChange({ product: e.target.value })}
            placeholder="Full scope or package title"
          />
        </Label>
      </div>
    );
  if (section === "value")
    return (
      <div className={styles.fieldColumn}>
        <Label className={styles.label}>
          Entity / Consortium
          <OptionSelect
            field="entitas"
            label="Entity / Consortium"
            className={styles.input}
            value={values.entitas}
            options={options.entitas}
            onChange={(entitas) => onChange({ entitas })}
          />
        </Label>
        <div className={styles.fieldRow2}>
          {(
            [
              ["qty", "Quantity"],
              ["oe", "OE (Rp)"],
            ] as const
          ).map(([key, label]) => (
            <Label key={key} className={styles.label}>
              {label}
              <NumberInput
                className={styles.input}
                value={values[key]}
                onChange={(value) => onChange({ [key]: value })}
                placeholder="Leave blank if unknown"
              />
            </Label>
          ))}
        </div>
        <Label className={styles.label}>
          OE note
          <Input
            className={styles.input}
            value={values.oeCatatan}
            onChange={(e) => onChange({ oeCatatan: e.target.value })}
            placeholder="Currency or valuation context"
          />
        </Label>
        <Label className={styles.label}>
          Our bid value (Rp)
          <NumberInput
            className={styles.input}
            value={values.nilaiPenawaran}
            onChange={(nilaiPenawaran) => onChange({ nilaiPenawaran })}
            placeholder="Leave blank if unknown"
          />
        </Label>
        <p className={styles.hint}>
          Values are in rupiah. Decimal quantities are supported. Unknown values
          stay blank and are excluded from known-value analytics.
        </p>
      </div>
    );
  const edit = values as TenderEditFormValues;
  return (
    <div className={styles.fieldColumn}>
      <div className={styles.fieldRow2}>
        <Label className={styles.label}>
          Result
          <NativeSelect
            className={styles.input}
            value={edit.result}
            onChange={(e) => onChange({ result: e.target.value })}
          >
            <NativeSelectOption value="">Active / no result</NativeSelectOption>
            {RESULT_ENUM.map((r) => (
              <NativeSelectOption key={r}>{r}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className={styles.label}>
          Carry over
          <Input
            className={styles.input}
            value={edit.carryOver}
            onChange={(e) => onChange({ carryOver: e.target.value })}
          />
        </Label>
      </div>
      <Label className={styles.label}>
        Remarks
        <Textarea
          className={styles.textarea}
          rows={6}
          value={edit.remarks}
          onChange={(e) => onChange({ remarks: e.target.value })}
          placeholder="Working notes, competitor rankings, and next actions"
        />
      </Label>
      <Label className={styles.label}>
        Short status note
        <Input
          className={styles.input}
          value={edit.remark}
          onChange={(e) => onChange({ remark: e.target.value })}
        />
      </Label>
      <Label className={styles.checkLabel}>
        <Checkbox
          checked={edit.pnl}
          onCheckedChange={(checked) => onChange({ pnl: checked === true })}
        />
        P&L flagged
      </Label>
      <Label className={styles.label}>
        Internal notes · admin only
        <Textarea
          className={styles.textarea}
          rows={4}
          value={edit.catatanInternal}
          onChange={(e) => onChange({ catatanInternal: e.target.value })}
        />
      </Label>
    </div>
  );
}
