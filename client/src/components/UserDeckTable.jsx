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

// Same table as DeckTable, scoped to the logged-in user's own decks
// (GET /api/decks/me) instead of every deck ArchRider knows about --
// DeckTable stays as the admin view over the full dataset. No Owner
// column here since every row belongs to the same user. The Sync
// action is a placeholder: actually pulling fresh data from Archidekt
// and spending a credit for it is ingestion work, explicitly future
// scope (see HANDOFF_CREDITS.md), not built yet.
const UserDeckTable = () => {
  const [data, setData] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  useEffect(() => {
    fetch('/api/decks/me', { credentials: 'include' })
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Error fetching my decks:', err));
  }, []);

  const columns = useMemo(() => [
    {
      header: 'Deck Name', accessorKey: 'name', cell: ({ row, getValue }) => (
        <Link to={`/decks/${row.original.archidekt_id}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
          {getValue()}
        </Link>
      ), enableColumnFilter: false
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
  ], []);

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
        <button
          disabled
          title="Syncing your decklist from Archidekt (spending a credit) is coming soon"
          className="px-4 py-2 border rounded text-xs font-bold uppercase text-slate-400 border-slate-200 cursor-not-allowed"
        >
          Sync Decklist
        </button>
      </div>

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
