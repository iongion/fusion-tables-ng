import * as React from "react";
import { render } from "react-dom";
import {
  Alignment,
  Button,
  Classes,
  Dialog,
  Icon,
  InputGroup,
  Menu,
  MenuItem,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading,
  Popover,
  Position,
  ButtonGroup,
  MenuDivider,
  Checkbox,
  Intent
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import uniq from "lodash/uniq";
import sortBy from "lodash/sortBy";
import isEmpty from "lodash/isEmpty";
import isString from "lodash/isString";
import isNumber from "lodash/isNumber";
import Clipboard from "clipboard";
import numeral from "numeral";
import { getCode, getName } from "country-list";
import ReactCountryFlag from "react-country-flag";
// project
import Api from "./Api";
import BlockUI from "./BlockUI";
import Toaster from "./Toaster";
// styles
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "./App.css";
//
const isNumeric = (value: any) => {
  return isNumber(value) || (!isEmpty(value) && !isNaN(value));
};
const formatCountry = input => {
  const countryCode = getCode(input) || getCode(input.replace(/The\s/gim, ""));
  if (!countryCode) {
    console.warn("Cannot match country", input);
    return input;
  }
  return (
    <div>
      <ReactCountryFlag code={countryCode.toLowerCase()} svg />
      &nbsp;
      <strong>{input}</strong>
    </div>
  );
};
const formatHeader = (header: any, value: any) => {
  let output = value;
  if (value !== null && typeof value !== "undefined") {
    if (isString(value)) {
      output = value.trim();
      const lValue = output.toLowerCase();
      if (lValue === "na" || lValue === "n/a" || lValue === "") {
        output = (
          <Icon
            icon={IconNames.SMALL_CROSS}
            iconSize={Icon.SIZE_STANDARD}
            title="Not available"
          />
        );
      } else if (lValue.indexOf("http") === 0) {
        output = (
          <a href={output} rel="noopener noreferrer" target="_blank">
            {output}
          </a>
        );
      } else {
        // Fuzzy matching
        const listItems = output
          .split(";")
          .map(it => it.trim())
          .filter(it => !!it);
        if (listItems.length === 1) {
          if (header.name === "Country") {
            output = formatCountry(output);
          }
        } else if (listItems.length > 1) {
          output = (
            <ul
              className="AppDataViewRecordTableColumnListValue"
              data-header={header.name}
            >
              {listItems.map((it, idx) => {
                let out = it;
                if (header.name === "Country") {
                  out = formatCountry(out);
                }
                return <li key={idx}>{out}</li>;
              })}
            </ul>
          );
        }
      }
    } else if (isNumber(value)) {
      output = numeral(value).format("0,0[.]00");
    }
  } else {
    output = (
      <Icon
        icon={IconNames.SMALL_CROSS}
        iconSize={Icon.SIZE_STANDARD}
        title="Not available"
        intent={Intent.DANGER}
      />
    );
  }
  return output;
};
const decodeDocumentIdFromUrl = (url: string) => {
  // https://docs.google.com/spreadsheets/d/DOCUMENT_ID/edit
  const input = url.split("/");
  return input[5];
};
const decodeDocumentId = (input?: string) => {
  const inputQuery = decodeURIComponent(
    input || window.location.search.substring(1)
  );
  let documentId = "";
  if (inputQuery.indexOf("http") === 0) {
    documentId = decodeDocumentIdFromUrl(inputQuery);
  } else {
    documentId = inputQuery.split("&")[0]; // split to eliminate other urls change
  }
  return documentId;
};
// types
enum VIEW_MODES {
  LIST = "view.list",
  GRID = "view.grid"
}
interface IAppDatabase {
  documentId: string;
  sheets: Array<any>;
}
interface IAppProps {}
interface IAppState {
  isBlocked: boolean;
  inputDocument: string;
  viewMode: VIEW_MODES;
  searchTerm: string;
  database: IAppDatabase | null;
}
interface IViewMode {
  type: VIEW_MODES;
  label: string;
  icon: any;
}
// locals
const ViewModes: Array<IViewMode> = [
  { type: VIEW_MODES.LIST, label: "List", icon: IconNames.LIST },
  { type: VIEW_MODES.GRID, label: "Grid", icon: IconNames.GRID }
];

interface IDataViewProps {
  mode: VIEW_MODES;
  database: IAppDatabase | null;
  search: string;
}
interface IDataViewState {
  displayRecord: any;
  filtersMap: any;
  searchMap: any;
  sortingMap: any;
}

class AppDataView extends React.PureComponent<IDataViewProps, IDataViewState> {
  constructor(props: IDataViewProps, context: any) {
    super(props, context);
    this.state = {
      displayRecord: null,
      filtersMap: {},
      searchMap: {},
      sortingMap: {}
    };
  }
  getHeaderMenuOptions(header) {
    let options = [];
    if (this.props.database) {
      const records = this.props.database.sheets[0].records;
      const items = records
        .map(record => record[header.name])
        .map(it => {
          if (header.type === "String") {
            return `${it}`.trim();
          }
          return it;
        });
      let itemsList = [];
      items.forEach(it => {
        const values = it.split(";").map(it => it.trim());
        itemsList = itemsList.concat(values);
      });
      itemsList = itemsList.filter(
        (it: any) =>
          it !== "NA" && it !== "N/A" && it !== "undefined" && it.length
      );
      itemsList = uniq(itemsList).sort();
      options = itemsList;
    }
    return options;
  }
  onTableRowSelected = record => {
    if (this.props.database) {
      this.setState({
        displayRecord: record
      });
    }
  };
  onDisplayRecordDialogClose = () => {
    this.setState({
      displayRecord: null
    });
  };
  onHeaderSearchTermChanged = (e: any) => {
    e.persist();
    const header = e.target.getAttribute("data-header-name");
    this.setState(prevState => {
      const { searchMap } = prevState;
      searchMap[header] = e.target.value;
      return {
        ...prevState,
        searchMap: {
          ...searchMap
        }
      };
    });
  };
  getCurrentRecords() {
    let headers: Array<any> = [];
    let records: Array<any> = [];
    if (this.props.database) {
      headers = this.props.database.sheets[0].headers;
      records = this.props.database.sheets[0].records.slice(0);
    }
    // Apply global search
    records = records.filter(record => {
      let isMatching = false;
      if (this.props.search) {
        // Check every column
        for (let h = 0; h < headers.length; h++) {
          const headerName = headers[h].name;
          if (isString(record[headerName])) {
            const haystack = record[headerName].toLowerCase();
            const needle = this.props.search.toLowerCase();
            const flag = haystack.indexOf(needle) !== -1;
            if (flag) {
              isMatching = true;
              break;
            }
          }
        }
      } else {
        isMatching = true;
      }
      return isMatching;
    });
    // Apply filters
    const { filtersMap } = this.state;
    Object.keys(filtersMap).forEach(headerName => {
      const allowedValues = filtersMap[headerName];
      if (allowedValues.length) {
        records = records.filter(record => {
          let isMatching = false;
          for (let av = 0; av < allowedValues.length; av++) {
            const needle = allowedValues[av];
            const haystack = record[headerName] || "";
            if (isNumber(haystack)) {
              isMatching = `${needle}` === `${haystack}`;
            } else {
              isMatching = haystack.indexOf(needle) !== -1;
            }
            if (isMatching) {
              break;
            }
          }
          return isMatching;
        });
      }
    });
    // Apply sort
    const { sortingMap } = this.state;
    Object.keys(sortingMap).forEach(headerName => {
      const sortDirection = sortingMap[headerName];
      if (sortDirection === "asc") {
        records = sortBy(records, [headerName]);
      } else {
        records = sortBy(records, [headerName]).reverse();
      }
    });
    // Apply search by contents
    const { searchMap } = this.state;
    Object.keys(searchMap).forEach(headerName => {
      const searchTerm = searchMap[headerName];
      records = records.filter(record => {
        const haystack = record[headerName].toLowerCase();
        const needle = searchTerm.toLowerCase();
        const flag = haystack.indexOf(needle) !== -1;
        return flag;
      });
    });
    return records;
  }
  renderList() {
    let headers: Array<any> = [];
    let records: Array<any> = [];
    if (this.props.database) {
      headers = this.props.database.sheets[0].headers;
    }
    // Apply filters
    const { filtersMap } = this.state;
    records = this.getCurrentRecords();
    return (
      <table className="bp3-html-table bp3-html-table-bordered bp3-html-table-condensed bp3-html-table-striped bp3-small bp3-interactive AppDataViewTable">
        <thead>
          <tr>
            <th style={{ width: "40px" }}>#</th>
            {headers.map(header => {
              const headerMenuOptions = this.getHeaderMenuOptions(header);
              const onSort = mode => {
                this.setState(
                  prevState => {
                    const { sortingMap } = prevState;
                    if (sortingMap[header.name] === mode) {
                      delete sortingMap[header.name];
                    } else {
                      sortingMap[header.name] = mode;
                    }
                    return {
                      ...prevState,
                      sortingMap: {
                        ...sortingMap
                      }
                    };
                  },
                  () => {
                    console.debug("Sorting applied", this.state.sortingMap);
                  }
                );
              };
              const isSortAsc = this.state.sortingMap[header.name] === "asc";
              const isSortDesc = this.state.sortingMap[header.name] === "desc";
              const searchTerm = this.state.searchMap[header.name] || "";
              const headerMenu = (
                <Menu>
                  <MenuItem
                    icon={IconNames.SORT_ASC}
                    text="A to Z"
                    onClick={() => onSort("asc")}
                    active={isSortAsc}
                    title="Sort ascending"
                  />
                  <MenuItem
                    icon={IconNames.SORT_DESC}
                    text="Z to A"
                    onClick={() => onSort("desc")}
                    active={isSortDesc}
                    title="Sort descending"
                  />
                  <MenuDivider />
                  <InputGroup
                    leftIcon={IconNames.FILTER}
                    placeholder="Type to begin filtering"
                    dir="auto"
                    type="search"
                    autoComplete="off"
                    value={searchTerm}
                    data-header-name={header.name}
                    onChange={this.onHeaderSearchTermChanged}
                  />
                  <MenuDivider />
                  <div className="AppDataViewTableHeaderFilterCheckboxes">
                    {headerMenuOptions.map(option => {
                      let isFiltered = false;
                      if (
                        filtersMap[header.name] &&
                        filtersMap[header.name].indexOf(option) !== -1
                      ) {
                        isFiltered = true;
                      }
                      const onCheckBoxClick = e => {
                        const isApplied = e.currentTarget.checked;
                        this.setState(
                          prevState => {
                            const { filtersMap } = prevState;
                            if (isApplied) {
                              if (!filtersMap[header.name]) {
                                filtersMap[header.name] = [];
                              }
                              filtersMap[header.name].push(option);
                            } else {
                              if (filtersMap[header.name]) {
                                filtersMap[header.name] = filtersMap[
                                  header.name
                                ].filter(it => it !== option);
                              }
                            }
                            return {
                              ...prevState,
                              filtersMap: {
                                ...filtersMap
                              }
                            };
                          },
                          () => {
                            console.debug("Filters updated");
                          }
                        );
                      };
                      return (
                        <Checkbox
                          key={option}
                          label={option}
                          className="AppDataViewTableHeaderFilterCheckbox"
                          onChange={onCheckBoxClick}
                          checked={isFiltered}
                        />
                      );
                    })}
                  </div>
                </Menu>
              );
              const headerWidget = (
                <div className="AppDataViewTableHeader">
                  <span
                    className="AppDataViewTableHeaderLabel"
                    title={header.name}
                  >
                    {header.name}
                  </span>
                  <Popover content={headerMenu} position={Position.BOTTOM}>
                    <Button small minimal icon={IconNames.CARET_DOWN} />
                  </Popover>
                </div>
              );
              return (
                <th key={header.name} data-header={header.name}>
                  {headerWidget}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => {
            return (
              <tr key={index} onClick={() => this.onTableRowSelected(record)}>
                <td>{index + 1}</td>
                {headers.map(header => (
                  <td key={header.name}>
                    {formatHeader(header, record[header.name])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  renderGrid() {
    let headers: Array<any> = [];
    let records: Array<any> = [];
    if (this.props.database) {
      headers = this.props.database.sheets[0].headers;
    }
    records = this.getCurrentRecords();
    return (
      <div className="AppDataViewGrid">
        <div className="AppDataViewGridContainer">
          {records.map((record, index) => (
            <div
              key={index}
              className="AppDataViewGridContainerItem"
              data-record-index={index}
            >
              <ul className={Classes.LIST}>
                {headers.map((header, index) => (
                  <li key={index}>
                    <strong>{header.name}</strong>
                    <span>{record[header.name]}</span>
                  </li>
                ))}
              </ul>
              <div className="AppDataViewGridContainerItemFade">
                <Button
                  small
                  className="AppDataViewGridContainerItemMoreButton"
                  type="button"
                  text="Details"
                  data-record-index={index}
                  onClick={() => this.onTableRowSelected(record)}
                  icon={IconNames.LIST_DETAIL_VIEW}
                  intent={Intent.PRIMARY}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  render() {
    const record = this.state.displayRecord;
    let view: any = null;
    switch (this.props.mode) {
      case VIEW_MODES.LIST:
        view = this.renderList();
        break;
      case VIEW_MODES.GRID:
        view = this.renderGrid();
        break;
      default:
        break;
    }
    let dialog: any = null;
    if (record) {
      let headers: Array<any> = [];
      if (this.props.database) {
        headers = this.props.database.sheets[0].headers;
      }
      dialog = (
        <Dialog
          isOpen
          icon={IconNames.INFO_SIGN}
          title={record.Name}
          onClose={this.onDisplayRecordDialogClose}
          className="AppDataViewRecordDialog"
        >
          <div className={Classes.DIALOG_BODY}>
            <table className="bp3-html-table bp3-html-table-bordered bp3-html-table-condensed bp3-html-table-striped bp3-small bp3-interactive AppDataViewRecordTable">
              <tbody>
                {headers.map((header, index) => (
                  <tr key={index}>
                    <td>
                      <strong>{header.name}</strong>
                    </td>
                    <td>{formatHeader(header, record[header.name])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Dialog>
      );
    }
    return (
      <div className="AppDataView">
        {view}
        {dialog}
      </div>
    );
  }
}

class App extends React.PureComponent<IAppProps, IAppState> {
  private api: Api = new Api();
  private clipboard: Clipboard | null = null;
  constructor(props, context) {
    super(props, context);
    this.state = {
      isBlocked: false,
      inputDocument: window.localStorage.getItem("document.id") || "",
      viewMode: VIEW_MODES.LIST,
      searchTerm: "",
      database: null
    };
  }
  componentDidMount() {
    this.clipboard = new Clipboard(".AppHeaderButtonShareUrl");
    this.clipboard.on("success", () => {
      Toaster.notify("Sharing url has been copied to your clipboard");
    });
    this.clipboard.on("error", e => {
      console.error("Unable to copy shared url to clipboard");
    });
    const id = decodeDocumentId(); // from query
    if (id) {
      this.setState(
        {
          inputDocument: id
        },
        () => {
          this.loadDocument();
        }
      );
    } else {
      this.loadDocument();
    }
  }
  loadDocument() {
    const id = this.state.inputDocument;
    if (!id) {
      console.debug("No document was specified");
      return;
    }
    this.setState({ isBlocked: true }, () => {
      // 1f-FvO_vnyD6X78gtdSRn4v-U3WwjnePJ9FXdY4gLQ3Q
      this.api.fetchDocument(id).then(database => {
        this.setState(
          prevState => ({
            ...prevState,
            database: database as IAppDatabase,
            isBlocked: false
          }),
          () => {
            console.debug(">> Database is here", database);
          }
        );
      });
    });
  }
  onViewModeClick = e => {
    const viewMode = e.currentTarget.getAttribute("data-view-mode");
    this.setState({
      viewMode
    });
  };
  onGlobalSearchTermChange = e => {
    this.setState({
      searchTerm: e.target.value
    });
  };
  onDocumentFetchClick = () => {
    this.loadDocument();
  };
  onInputDocumentChange = e => {
    this.setState(
      {
        inputDocument: e.target.value
      },
      () => {
        window.localStorage.setItem("document.id", this.state.inputDocument);
      }
    );
  };
  render() {
    const {
      isBlocked,
      database,
      inputDocument,
      searchTerm,
      viewMode
    } = this.state;
    let shareUrl = "";
    if (database) {
      shareUrl = `${window.location.origin}${
        window.location.pathname
      }?${encodeURIComponent(database.documentId)}`;
    }
    const searchButtons = (
      <ButtonGroup>
        <Button icon={IconNames.DOWNLOAD} onClick={this.onDocumentFetchClick} />
        <Button
          className="AppHeaderButtonShareUrl"
          icon={IconNames.SOCIAL_MEDIA}
          data-clipboard-text={shareUrl}
        />
      </ButtonGroup>
    );
    const content = database ? (
      <AppDataView mode={viewMode} database={database} search={searchTerm} />
    ) : null;
    return (
      <BlockUI blocking={isBlocked} className="App">
        <div className="AppHeader">
          <Navbar className="AppNavbar">
            <NavbarGroup className="AppInputDocumentGroup">
              <NavbarHeading>Document</NavbarHeading>
              <InputGroup
                leftIcon={IconNames.DOCUMENT}
                placeholder="Type the shared link"
                dir="auto"
                type="text"
                autoComplete="off"
                rightElement={searchButtons}
                value={inputDocument}
                onChange={this.onInputDocumentChange}
                fill
              />
            </NavbarGroup>
            <NavbarGroup align={Alignment.RIGHT}>
              <NavbarHeading>View</NavbarHeading>
              <ButtonGroup>
                {ViewModes.map(mode => (
                  <Button
                    key={mode.type}
                    className={Classes.MINIMAL}
                    active={viewMode === mode.type}
                    icon={mode.icon}
                    text={mode.label}
                    data-view-mode={mode.type}
                    onClick={this.onViewModeClick}
                  />
                ))}
              </ButtonGroup>
              <NavbarDivider />
              <NavbarHeading>Search</NavbarHeading>
              <InputGroup
                leftIcon={IconNames.SEARCH}
                placeholder="Type to begin search"
                dir="auto"
                type="search"
                autoComplete="off"
                value={searchTerm}
                onChange={this.onGlobalSearchTermChange}
              />
            </NavbarGroup>
          </Navbar>
        </div>
        <div className="AppContent">{content}</div>
      </BlockUI>
    );
  }
}

const rootElement = document.getElementById("root");
render(<App />, rootElement);
