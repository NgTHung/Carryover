import journal from './meta/_journal.json';
import m0000 from './0000_initial-ledger.sql';
import m0001 from './0001_safe-amount-bounds.sql';
import m0002 from './0002_seed-accounts.sql';
import m0003 from './0003_repair-cash-account.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
  },
};
