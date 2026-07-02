// ColumnFilter.jsx
import React from 'react';

const NULL_TOKEN = '__NULL__';

const ColumnFilter = ({ column }) => {
  const filterValue = column.getFilterValue();
  const setFilterValue = column.setFilterValue;

  const sortedUniqueValues = React.useMemo(
    () =>
      Array.from(column.getFacetedUniqueValues().keys()).sort((a, b) => {
        if (a === null || a === undefined) return 1;
        if (b === null || b === undefined) return -1;
        return String(a).localeCompare(String(b));
      }),
    [column.getFacetedUniqueValues()]
  );

  return (
    <select
      value={filterValue === null ? NULL_TOKEN : filterValue ?? ''}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '') setFilterValue(undefined);
        else if (val === NULL_TOKEN) setFilterValue(null);
        else setFilterValue(val);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <option value="">All</option>
      {sortedUniqueValues.map((value) => (
        <option
          key={value === null || value === undefined ? NULL_TOKEN : String(value)}
          value={value === null || value === undefined ? NULL_TOKEN : value}
        >
          {value === null || value === undefined ? 'Unassigned' : value}
        </option>
      ))}
    </select>
  );
};

export default ColumnFilter;