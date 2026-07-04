// UserDeckTable.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, flexRender
} from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import BracketBadge from './BracketBadge';
import NameplateBadge from './NamePlateBadge';
import { getColorIdentityName } from '../utils/colorUtils';
import ColumnFilter from './ColumnFilter';

// Archidekt's own last-modified timestamp for the deck (updated_at) newer
// than our last full per-deck sync (last_synced, only ever touched by
// probe.js -- see migration 017) means the user has changed something on
// Archidekt that we haven't pulled yet. No last_synced at all means the
// deck has never been individually synced.
const needsSync = (deck) =>
    !deck.last_synced || (deck.updated_at && new Date(deck.updated_at) > new Date(deck.last_synced));

const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'Never');

// Same table as DeckTable, scoped to the logged-in user's own decks
// (GET /api/decks/me) instead of every deck ArchRider knows about --
// DeckTable stays as the admin view over the full dataset. No Owner
// column here since every row belongs to the same user.
const UserDeckTable = () => {
  const [data, setData] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [probingId, setProbingId] = useState(null);
  const [probeError, setProbeError] = useState(null);

  const loadDecks = () => {
    fetch('/api/decks/me', { credentials: 'include' })
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Error fetching my decks:', err));
  };

  useEffect(() => {
    loadDecks();
  }, []);

  const handleSync = () => {
    setSyncing(true);
    setSyncMessage(null);
    fetch('/api/decks/me/sync', { method: 'POST', credentials: 'include' })
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Sync failed');
        loadDecks();
        if (body.partial) {
          setSyncMessage(
            `Synced ${body.decksSynced} of ${body.totalDecks} decks (spent ${body.creditsSpent} credit${body.creditsSpent === 1 ? '' : 's'}). ` +
            `Need ${body.creditsNeededForRest} more credit${body.creditsNeededForRest === 1 ? '' : 's'} to sync the rest. ${body.creditsRemaining} remaining.`
          );
        } else {
          setSyncMessage(`Synced all ${body.decksSynced} decks (spent ${body.creditsSpent} credit${body.creditsSpent === 1 ? '' : 's'}). ${body.creditsRemaining} credits remaining.`);
        }
      })
      .catch(err => setSyncMessage(err.message))
      .finally(() => setSyncing(false));
  };

  const handleProbe = (deckId) => {
    setProbingId(deckId);
    setProbeError(null);
    fetch(`/api/decks/${deckId}/probe`, { method: 'POST', credentials: 'include' })
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Probe failed');
        loadDecks();
      })
      .catch(err => setProbeError(err.message))
      .finally(() => setProbingId(null));
  };

  const columns = useMemo(() => [
    {
      header: 'Deck Name', accessorKey: 'name', cell: ({ row, getValue }) => {
        const deck = row.original;
        return (
          <div className="flex items-center gap-2">
            {needsSync(deck) && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"
                title="Archidekt shows changes since this deck was last fully synced"
              />
            )}
            {deck.hasCardList ? (
              <Link to={`/decks/${deck.archidekt_id}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
                {getValue()}
              </Link>
            ) : (
              <>
                <span className="text-slate-500">{getValue()}</span>
                <button
                  onClick={() => handleProbe(deck.archidekt_id)}
                  disabled={probingId === deck.archidekt_id}
                  className="px-2 py-0.5 border rounded text-[10px] font-bold uppercase text-slate-500 border-slate-300 hover:border-slate-500 disabled:opacity-50"
                >
                  {probingId === deck.archidekt_id ? 'Probing...' : 'Probe (1 credit)'}
                </button>
              </>
            )}
          </div>
        );
      }, enableColumnFilter: false
    },
    {
      header: 'Bracket',
      accessorKey: 'edh_bracket',
      cell: ({ getValue }) => <BracketBadge level={getValue()} />,
      enableColumnFilter: true,
      filterFn: 'equals'
    },
    {
      header: 'Color Identity',
      id: 'color_identity',
      accessorFn: (row) => getColorIdentityName(row.color_identity),
      cell: ({ row }) => <NameplateBadge identity={row.original.color_identity} />,
      enableColumnFilter: true,
    },
    { header: 'Cards', accessorKey: 'card_count', enableColumnFilter: false },
    {
      header: 'Updated At (Archidekt)',
      accessorKey: 'updated_at',
      cell: ({ getValue }) => <span className="text-xs text-slate-500">{formatDate(getValue())}</span>,
      enableColumnFilter: false
    },
    {
      header: 'Last Synced',
      accessorKey: 'last_synced',
      cell: ({ getValue }) => <span className="text-xs text-slate-500">{formatDate(getValue())}</span>,
      enableColumnFilter: false
    },
  ], [probingId]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    filterFns: {
      equals: (row, columnId, filterValue) => {
        if (filterValue === undefined) return true;
        const cellValue = row.getValue(columnId);
        if (filterValue === null) return cellValue === null || cellValue === undefined;
        return String(cellValue) === String(filterValue);
      }
    }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-slate-800">My Decks</h2>
        <div className="text-right">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 border rounded text-xs font-bold uppercase text-slate-700 border-slate-300 hover:border-slate-500 disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Decklist'}
          </button>
          {syncMessage && <p className="text-xs text-slate-500 mt-1 max-w-xs">{syncMessage}</p>}
        </div>
      </div>

      {probeError && <p className="text-sm text-red-600 mb-4">{probeError}</p>}

      {data.length === 0 ? (
        <p className="text-sm text-slate-500">No decks found yet in ArchRider for your account.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div
                      className="cursor-pointer hover:text-gray-800 flex items-center gap-1"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted() ?? null]}
                    </div>
                    {header.column.getCanFilter() && (
                      <ColumnFilter column={header.column} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserDeckTable;
