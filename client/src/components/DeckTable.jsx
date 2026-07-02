// DeckTable.jsx
import React, { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getFacetedRowModel, getFacetedUniqueValues, flexRender
} from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import BracketBadge from './BracketBadge';
import ColorBadge from './ColorBadge';
import NameplateBadge from './NamePlateBadge';
import { getColorIdentityName } from '../utils/colorUtils';
import ColumnFilter from './ColumnFilter'; // Add this import

const DeckTable = ({ data }) => {
  const [sorting, setSorting] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);

  const columns = useMemo(() => [
    {
      header: 'Deck Name', accessorKey: 'name', cell: ({ row, getValue }) => (
        <Link to={`/decks/${row.original.archidekt_id}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
          {getValue()}
        </Link>
      ), enableColumnFilter: false
    },
    { header: 'Owner', accessorKey: 'owner_username', enableColumnFilter: true },
    {
      header: 'Bracket',
      accessorKey: 'edh_bracket',
      cell: ({ getValue }) => <BracketBadge level={getValue()} />,
      enableColumnFilter: true,
      filterFn: 'equals' // <--- THIS is likely the missing link!
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

    // Add this to handle the filtering logic globally
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
  );
};

export default DeckTable;