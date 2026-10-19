// Synthetic owner snapshots. No commercial price or credential is provisioned by these fixtures.
export const disabled={schemaVersion:1,enabled:false,paymentsEnabled:false,ciEnabled:false,offer:'FREE',status:'NONE',phase:'NONE',sync:'NEVER',
  interval:null,periodEnd:null,lastSyncedAt:null,diagnostic:null,canCheckout:false,portalAvailable:false,
  plans:[{interval:'MONTH',currency:'EUR',amountHtCents:1900},{interval:'YEAR',currency:'EUR',amountHtCents:19900}]};
export const active={...disabled,enabled:true,offer:'PREMIUM',status:'ACTIVE',sync:'CURRENT',interval:'MONTH',periodEnd:'2026-11-19T12:00:00Z',
  lastSyncedAt:'2026-10-19T12:00:00Z',portalAvailable:true};
export const ready={...disabled,enabled:true,paymentsEnabled:true,canCheckout:true,
  plans:[{interval:'MONTH',currency:'EUR',amountHtCents:1000},{interval:'YEAR',currency:'EUR',amountHtCents:11000}]};
export const variants={
  disabled,active,ready,
  ending:{...active,status:'CANCEL_AT_PERIOD_END'},
  unpaid:{...active,status:'PAYMENT_REQUIRED'},
  refund:{...active,status:'REFUNDED'},
  dispute:{...active,status:'DISPUTED'},
  ended:{...active,status:'ENDED',offer:'FREE'},
  delayed:{...active,sync:'DEFERRED',diagnostic:'billing_sync_pending'},
  pending:{...ready,phase:'OPEN',sync:'PENDING',interval:'YEAR',portalAvailable:true},
  expired:{...ready,phase:'EXPIRED'},
  manual:{...disabled,offer:'PREMIUM',diagnostic:'billing_managed_elsewhere'},
};
