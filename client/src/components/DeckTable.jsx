import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import BracketBadge from './BracketBadge'; // Import the BracketBadge component
import ColorBadge from './ColorBadge'; // Import the ColorBadge component
import NameplateBadge from './NamePlateBadge'; // Import your new component


const DeckTable = ({ data }) => {
  const columns = [
    {
      header: 'Deck Name',
      accessorKey: 'name',
      // Wrap the content in a Link
      cell: ({ row, getValue }) => (
        <Link
          to={`/decks/${row.original.archidekt_id}`}
          className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
        >
          {getValue()}
        </Link>
      )
    },
    { header: 'Owner', accessorKey: 'owner_username' },
    {
      header: 'Bracket',
      accessorKey: 'edh_bracket',
      cell: ({ getValue }) => <BracketBadge level={getValue()} />
    },
    {
      header: 'Color Identity',
      accessorKey: 'color_identity',
      cell: ({ getValue }) => <NameplateBadge identity={getValue()} />
    },
    { header: 'Cards', accessorKey: 'card_count' }
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {flexRender(header.column.columnDef.header, header.getContext())}
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