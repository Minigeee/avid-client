import {
  MutableRefObject,
  ReactElement,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Box,
  BoxProps,
  Checkbox,
  CheckboxProps,
  Loader,
  useMantineTheme,
} from '@mantine/core';

import { IconChevronDown } from '@tabler/icons-react';

import ReactDataTable, {
  TableColumn,
  TableStyles,
} from 'react-data-table-component';
import {
  ConditionalStyles,
  ExpandableRowsComponent,
} from 'react-data-table-component/dist/src/DataTable/types';

////////////////////////////////////////////////////////////
const CustomCheckbox = forwardRef((props: CheckboxProps, ref) => {
  return (
    <>
      <Checkbox
        {...props}
        size='xs'
        styles={(theme) => ({
          input: {
            cursor: 'pointer',
            '&:hover': {
              borderColor: theme.other.colors.panel_border,
            },
          },
        })}
      />
    </>
  );
});
CustomCheckbox.displayName = 'CustomTaskTableCheckbox';

////////////////////////////////////////////////////////////
function useTableStyles() {
  const theme = useMantineTheme();

  return useMemo(
    () =>
      ({
        table: {
          style: {
            borderRadius: '6px',
            background: theme.other.elements.data_table_header,
            color: theme.other.elements.data_table_header_text,
          },
        },
        headRow: {
          style: {
            fontSize: `${theme.fontSizes.sm}px`,
            fontWeight: 600,
            background: 'transparent',
            color: theme.other.elements.data_table_header_text,
            borderBottom: `1px solid ${theme.other.elements.data_table_border}`,
          },
        },
        rows: {
          style: {
            padding: '0.5rem 0rem',
            fontSize: `${theme.fontSizes.sm}px`,
            color: theme.other.elements.data_table_text,
            background: theme.other.elements.data_table,
            borderTop: `1px solid ${theme.other.elements.data_table_border}`,
            borderBottom: `1px solid ${theme.other.elements.data_table_border}`,
            '&:not(:last-of-type)': {
              borderBottom: 'none',
            },
          },
          highlightOnHoverStyle: {
            color: theme.other.elements.data_table_text,
            background: theme.other.elements.data_table_hover,
            transitionDuration: '0.08s',
            transitionProperty: 'background',
            outlineWidth: '0px',
            '&:last-child': {
              borderBottomColor: theme.other.elements.data_table_border,
            },
          },
        },
        pagination: {
          style: {
            color: theme.other.elements.data_table_header_text,
            fontSize: '13px',
            fontWeight: 600,
            minHeight: '3.0rem',
            background: theme.other.elements.data_table_header,
            borderTop: `solid 1px ${theme.other.elements.data_table_border}`,
            borderBottomLeftRadius: '6px',
            borderBottomRightRadius: '6px',
          },
          pageButtonsStyle: {
            borderRadius: '6px',
            height: '2.4rem',
            width: '2.4rem',
            cursor: 'pointer',
            transition: '0.18s',
            color: theme.other.elements.data_table_header_text,
            fill: theme.other.elements.data_table_header_text,
            background: 'transparent',
            '&:disabled': {
              cursor: 'unset',
              color: theme.other.elements.data_table_header_dimmed,
              fill: theme.other.elements.data_table_header_dimmed,
            },
            '&:hover:not(:disabled)': {
              background: theme.other.elements.data_table_header_hover,
            },
            '&:focus': {
              outline: 'none',
              background: theme.other.elements.data_table_header_hover,
            },
          },
        },
        expanderRow: {
          style: {
            color: theme.other.elements.data_table_dimmed,
            background: 'transparent',
          },
        },
        expanderButton: {
          style: {
            color: theme.other.elements.data_table_dimmed,
            fill: theme.other.elements.data_table_dimmed,
            background: 'transparent',
            height: '100%',
            width: '100%',
            '&:hover:not(:disabled)': {
              background: theme.other.elements.data_table_hover,
            },
            '&:focus': {
              background: 'transparent',
            },
          },
        },
        noData: {
          style: {
            height: '10rem',
            color: theme.other.colors.panel_dimmed,
            background: theme.other.colors.panel,
            borderRadius: 6,
          },
        },
        progress: {
          style: {
            height: '8rem',
            color: theme.other.colors.panel_text,
            background: theme.other.colors.panel,
          },
        },
      }) as TableStyles,
    [],
  );
}

////////////////////////////////////////////////////////////
export type DataTableState<T> = {
  /** The row that is currently being hovered */
  hovered: T | null;
  /** The rows that are currently selected */
  selected: T[];

  /** Clear row selection */
  clearSelected: () => void;
};

////////////////////////////////////////////////////////////
type DataTableProps<T> = {
  /** State ref */
  stateRef?: MutableRefObject<DataTableState<T>>;

  /** The columns of the table */
  columns: TableColumn<T>[];
  /** The data that should be displayed */
  data: T[];

  /** Indicates if table should be selectable */
  selectable?: boolean;

  /** Called when row is clicked */
  onRowClicked?: (row: T) => void;

  /** Rows per page */
  rowsPerPage?: number;
  /** Settings for remote pagination */
  paginationServer?: {
    /** Total number of rows */
    totalRows: number;
    /** Handles fetching of data on page change */
    onPageChange: (page: number, numRows: number) => void;
  };

  /** The expanded rows component */
  expandableRowsComponent?: (props: { data: T } & any) => ReactElement;
  /** Extra props to pass to expandable row component */
  expandableRowsProps?: any;

  /** Element that is shown when there is no data */
  emptyComponent?: ReactElement;
  /** Is data loading */
  loading?: boolean;
  /** Conditional role styles */
  rowStyles?: ConditionalStyles<T>[];
  /** Properties for wrapper component */
  wrapperProps?: BoxProps;
};

////////////////////////////////////////////////////////////
export default function DataTable<T extends { id: string }>({
  data,
  ...props
}: DataTableProps<T>) {
  const rowsPerPage = props.rowsPerPage || 20;

  // Table styles
  const styles = useTableStyles();

  // The task currently being hovered
  const [hovered, setHovered] = useState<T | null>(null);
  // Tasks that are selected
  const [selected, setSelected] = useState<T[]>([]);
  const [toggleCleared, setToggleCleared] = useState<boolean>(false);

  // State ref update
  useEffect(() => {
    if (!props.stateRef) return;

    props.stateRef.current = {
      hovered,
      selected,

      clearSelected: () => {
        // Toggle clear, reset selected
        setToggleCleared(!toggleCleared);
        setSelected([]);
      },
    };
  }, [hovered, selected, toggleCleared]);

  return (
    <Box {...props.wrapperProps}>
      <ReactDataTable<T>
        customStyles={styles}
        sortIcon={
          <IconChevronDown
            size={10}
            style={{ marginTop: '5px', marginLeft: '1px' }}
          />
        }
        columns={props.columns}
        data={data}
        responsive={false}
        pointerOnHover={props.onRowClicked !== undefined}
        highlightOnHover={props.onRowClicked !== undefined}
        onRowClicked={props.onRowClicked}
        onRowMouseEnter={setHovered}
        onRowMouseLeave={(row) => {
          if (hovered?.id === row.id) setHovered(null);
        }}
        pagination={
          (props.paginationServer?.totalRows || data.length) > rowsPerPage
        }
        paginationPerPage={rowsPerPage}
        paginationComponentOptions={{
          noRowsPerPage: true,
        }}
        paginationServer={props.paginationServer !== undefined}
        paginationTotalRows={props.paginationServer?.totalRows}
        onChangePage={props.paginationServer?.onPageChange}
        noDataComponent={props.emptyComponent}
        /* progressPending={props.loading}
        progressComponent={(
          <Loader size={24} />
        )} */

        selectableRows={props.selectable}
        // @ts-ignore
        selectableRowsComponent={CustomCheckbox}
        selectableRowsComponentProps={{
          indeterminate: (indeterminate: boolean) => indeterminate,
        }}
        onSelectedRowsChange={({ selectedRows }) => setSelected(selectedRows)}
        clearSelectedRows={toggleCleared}
        expandableRows={props.expandableRowsComponent !== undefined}
        expandableRowsComponent={props.expandableRowsComponent}
        expandableRowsComponentProps={props.expandableRowsProps}
        conditionalRowStyles={props.rowStyles}
      />
    </Box>
  );
}
