import React from "react";
import { componentErrorDescription } from "@/lib/componentErrorFeedback";

export type ComponentLoadFailure = readonly [string, unknown];

/** Errors stay visible beside the section, including failed background reloads. */
export function ComponentLoadErrors({ failures }: { failures: ComponentLoadFailure[] }) {
  const failed = failures.filter(([, error]) => !!error);
  if (!failed.length) return null;
  return (
    <div role="alert" className="m-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {failed.map(([section, error]) => (
        <p key={section}><strong>{section} Load Failed:</strong>{" "}
          {componentErrorDescription(error, `${section} could not be loaded. Refresh the register and try again.`)}
          {" "}This section is unavailable or may be out of date; it is not an empty result.
        </p>
      ))}
    </div>
  );
}
