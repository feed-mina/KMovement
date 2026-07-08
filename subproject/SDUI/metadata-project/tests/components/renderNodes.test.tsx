import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
    renderGridRepeater,
    renderLeaf,
    renderNodes,
    renderRepeater,
    RenderNodesContext,
    resolveAction,
    resolveClassName,
} from "@/components/DynamicEngine/renderNodes";
import { NormalizedNode } from "@/components/DynamicEngine/type";

jest.mock("@/components/constants/componentMap", () => {
    const React = require("react");
    const MockField = ({ id, data, formData, setFormData }: any) => (
        <div
            data-testid={`field-${id}`}
            data-has-form={formData ? "yes" : "no"}
            data-has-setter={setFormData ? "yes" : "no"}
        >
            {String(data?.label ?? data ?? id)}
        </div>
    );

    return {
        componentRegistry: {
            TEXT: { component: MockField },
            FORM_FIELD: { component: MockField, needsFormData: true, needsSetFormData: true },
            MODAL: { component: MockField, renderAsModal: true },
        },
    };
});

const createContext = (overrides: Partial<RenderNodesContext> = {}): RenderNodesContext => ({
    pageData: {},
    formData: { selected: true },
    setFormData: jest.fn(),
    onChange: jest.fn(),
    onAction: jest.fn(),
    getComponentData: jest.fn((_node: NormalizedNode, rowData: any) => rowData ?? { label: "leaf-data" }),
    extraProps: {},
    ...overrides,
});

describe("renderNodes helpers", () => {
    it("resolves group class names without duplicate layout classes", () => {
        expect(resolveClassName({ componentId: "summary", groupDirection: "ROW" })).toBe(
            "group-summary summary flex-row-layout"
        );
        expect(resolveClassName({ componentId: "cards", cssClass: "grid cards" })).toBe(
            "group-cards grid cards"
        );
    });

    it("resolves action props for click and keyboard activation", () => {
        const onAction = jest.fn();
        const node = { componentId: "card", actionType: "OPEN_DETAIL" };
        const { actionProps } = resolveAction(node, onAction, { id: 1 });

        render(<div data-testid="target" {...actionProps} />);
        const target = screen.getByTestId("target");

        expect(target).toHaveAttribute("role", "link");
        expect(target).toHaveAttribute("tabIndex", "0");

        fireEvent.click(target);
        fireEvent.keyDown(target, { key: "Enter" });

        expect(onAction).toHaveBeenCalledTimes(2);
        expect(onAction).toHaveBeenCalledWith(node, { id: 1 });
    });

    it("renders leaf components and injects declared form props", () => {
        const context = createContext();

        render(
            <>
                {renderLeaf({ componentId: "title", componentType: "TEXT" }, null, context)}
                {renderLeaf({ componentId: "form", componentType: "FORM_FIELD" }, null, context)}
                {renderLeaf({ componentId: "modal", componentType: "MODAL" }, null, context)}
            </>
        );

        expect(screen.getByTestId("field-title")).toHaveTextContent("leaf-data");
        expect(screen.getByTestId("field-form")).toHaveAttribute("data-has-form", "yes");
        expect(screen.getByTestId("field-form")).toHaveAttribute("data-has-setter", "yes");
        expect(screen.queryByTestId("field-modal")).not.toBeInTheDocument();
    });

    it("renders repeaters and forwards row data to actions", () => {
        const onAction = jest.fn();
        const context = createContext({ onAction });
        const node: NormalizedNode = {
            componentId: "items",
            actionType: "OPEN",
            children: [{ componentId: "label", componentType: "TEXT" }],
        };

        render(<>{renderRepeater(node, [{ label: "A" }, { label: "B" }], "item", "items", context)}</>);

        expect(screen.getAllByTestId("field-label")).toHaveLength(2);
        expect(screen.getAllByRole("link")).toHaveLength(2);

        fireEvent.click(screen.getByText("A"));
        expect(onAction).toHaveBeenCalledWith(node, { label: "A" });
    });

    it("renders grid repeaters in a container", () => {
        const context = createContext();
        const node: NormalizedNode = {
            componentId: "grid",
            cssClass: "grid",
            children: [{ componentId: "label", componentType: "TEXT" }],
        };

        const { container } = render(
            <>{renderGridRepeater(node, [{ label: "A" }], "grid-container", "grid", context)}</>
        );

        expect(container.firstElementChild).toHaveClass("grid-container");
        expect(screen.getByTestId("field-label")).toHaveTextContent("A");
    });

    it("renders node trees while skipping hidden and modal nodes", () => {
        const context = createContext();

        render(
            <>
                {renderNodes(
                    [
                        { componentId: "hidden", componentType: "TEXT", isVisible: false },
                        { componentId: "modal", componentType: "MODAL" },
                        { componentId: "visible", componentType: "TEXT" },
                    ],
                    context
                )}
            </>
        );

        expect(screen.queryByTestId("field-hidden")).not.toBeInTheDocument();
        expect(screen.queryByTestId("field-modal")).not.toBeInTheDocument();
        expect(screen.getByTestId("field-visible")).toBeInTheDocument();
    });
});
