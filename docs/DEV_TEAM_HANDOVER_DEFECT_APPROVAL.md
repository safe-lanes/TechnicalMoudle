# Defect Approval Settings Sync Handover

`defect_approval_settings` is deliberately shore-local because Defects approval
classification and workflow submission happen on shore. This task does not modify
`shared/syncConfig.ts`; the development team should add the following paste-ready entry
inside the `NO_SYNC` section of `SYNC_CONFIG`:

```ts
  defect_approval_settings: {
    tableName: 'defect_approval_settings',
    category: 'NO_SYNC',
    direction: 'none',
    identityColumn: 'dasuuid',
    vesselScopeColumn: null,
    vesselScopeJoinPath: null,
    isGlobal: true,
    isConfigurable: false,
    businessRules: null,
    notes: 'Shore-local Defects approval-routing singleton. Classification uses long_extension_days; ships do not run the approval engine or need this threshold.',
  },
```

Do not classify this table as shore-to-ship: its threshold is only used when the
shore-side Defects approval card submits an Approval Engine request.