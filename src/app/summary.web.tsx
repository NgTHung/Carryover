import { FIXTURE_MONTH_SUMMARY } from '../reports/month-summary-fixture';
import { MonthSummaryView } from '../ui/month-summary/MonthSummaryView';

export default function MonthSummaryWebScreen() {
  return (
    <MonthSummaryView
      state={{ status: 'ready', summary: FIXTURE_MONTH_SUMMARY }}
      period={FIXTURE_MONTH_SUMMARY.period}
      onChangePeriod={() => undefined}
      onRetry={() => undefined}
      previewNotice="Browser preview. This report uses fixture data and does not connect to the ledger."
    />
  );
}
