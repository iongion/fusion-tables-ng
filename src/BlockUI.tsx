// vendors
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as PropTypes from "prop-types";
import { Intent, Spinner } from "@blueprintjs/core";
//

interface IBlockUIProps {
  blocking: boolean;
  className?: string | null;
  message: "";
  children: any;
  loader: any;
  "data-active": string;
}
interface IBlockUIState {}

class BlockUI extends React.PureComponent<IBlockUIProps, IBlockUIState> {
  static defaultProps = {
    blocking: false,
    className: "",
    message: "",
    children: null,
    loader: null,
    "data-active": "yes"
  };
  static propTypes = {
    blocking: PropTypes.bool,
    className: PropTypes.string,
    message: PropTypes.string,
    children: PropTypes.any, // eslint-disable-line
    loader: PropTypes.any, // eslint-disable-line
    "data-active": PropTypes.string
  };
  private blockUIRef: any;
  private $blocker: any;
  constructor(props: IBlockUIProps, context: any) {
    super(props, context);
    this.state = {};
    this.blockUIRef = React.createRef();
  }
  componentDidMount() {
    this.$blocker = (window as any).$(this.blockUIRef.current);
    this.invalidate();
  }
  componentDidUpdate() {
    this.invalidate();
  }
  invalidate() {
    this.withBlockUI().then(() => {
      if (this.props.blocking) {
        if (this.props.message) {
          this.$blocker.block({ message: this.props.message });
        } else {
          const loader = this.props.loader || (
            <Spinner intent={Intent.PRIMARY} />
          );
          const node = document.createElement("div");
          ReactDOM.render(loader, node, () => {
            this.$blocker.block({ message: node });
          });
        }
      } else {
        this.$blocker.unblock();
      }
    });
  }
  withBlockUI() {
    return new Promise(resolve => {
      const { blockUI } = (window as any).$ as any;
      blockUI.defaults.message = "";
      blockUI.defaults.fadeIn = 0;
      blockUI.defaults.fadeOut = 0;
      blockUI.defaults.timeout = 0;
      blockUI.defaults.overlayCSS.opacity = 0.1;
      blockUI.defaults.css.border = "none";
      blockUI.defaults.css.backgroundColor = "#555";
      blockUI.defaults.css.padding = "20px";
      blockUI.defaults.css.borderRadius = "10px";
      blockUI.defaults.css.maxWidth = "100px";
      resolve(this);
    });
  }
  render() {
    const { children, blocking, className } = this.props;
    const otherProps: any = {};
    Object.keys(this.props).forEach((key: string) => {
      if (Object.keys(BlockUI.defaultProps).indexOf(key) !== -1) {
        return;
      }
      otherProps[key] = (this.props as any)[key];
    });
    return (
      <div
        className={`BlockUI ${className}`}
        ref={this.blockUIRef}
        data-blocking={blocking ? "yes" : "no"}
        data-active={this.props["data-active"]}
        {...otherProps}
      >
        {children}
      </div>
    );
  }
}

export default BlockUI;
