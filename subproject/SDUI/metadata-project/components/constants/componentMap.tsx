//  @@@@ 2026-02-07 추가 컴포넌트들을 한곳에 관리하는 파일
import InputField from "@/components/fields/InputField";
import TextField from "@/components/fields/TextField";
import ButtonField from "@/components/fields/ButtonField";
import ImageField from "@/components/fields/ImageField";
import SelectField from "@/components/fields/SelectField";
import PasswordField from "@/components/fields/PasswordField";
import TextAreaField from "@/components/fields/TextAreaField";
import EmailSelectField from "@/components/fields/EmailSelectField";
import EmotionSelectField from "@/components/fields/EmotionSelectField";
import RecordTimeComponent from "@/components/fields/RecordTimeComponent";
import DateTimePicker from "@/components/fields/DateTimePicker";
import TimeSelect from "@/components/fields/TimeSelect";
import TimeSlotRecord from "@/components/fields/TimeSlotRecord";
import AddressSearchGroup from "@/components/fields/AddressSearchGroup";
import { withRenderTrack } from "@/components/utils/withRenderTrack";
import Modal from "@/components/fields/Modal";
import AdminUserTable from "@/components/fields/AdminUserTable";
import AIChatComponent from "@/components/fields/AIChatComponent";
import AIChatComponentV2 from "@/components/fields/AIChatComponentV2";
import AIInterviewComponent from "@/components/fields/AIInterviewComponent";
import CheckboxField from "@/components/fields/CheckboxField";
import ThemeSettingsEditor from "@/components/fields/theme/ThemeSettingsEditor";
import StatCard from "@/components/fields/stats/StatCard";
import Chart from "@/components/fields/stats/Chart";
import GalleryGrid from "@/components/fields/gallery/GalleryGrid";
import HistoryList from "@/components/fields/history/HistoryList";

const GroupComponent: React.FC<any> = ({ children }) => <>{children}</>;

export interface ComponentRegistryEntry {
    component: React.FC<any>;
    needsFormData?: boolean;
    needsSetFormData?: boolean;
    renderAsModal?: boolean;
}

const register = (
    Component: React.FC<any>,
    traits: Omit<ComponentRegistryEntry, "component"> = {}
): ComponentRegistryEntry => ({
    component: withRenderTrack(Component, Component.displayName || Component.name || "Field"),
    ...traits,
});

export const componentRegistry: Record<string, ComponentRegistryEntry> = {
    MODAL: register(Modal, { renderAsModal: true }),
    INPUT: register(InputField),
    TEXT: register(TextField),
    PASSWORD: register(PasswordField),
    BUTTON: register(ButtonField),
    SNS_BUTTON: register(ButtonField),
    LINK_BUTTON: register(ButtonField),
    IMAGE: register(ImageField),
    EMAIL_SELECT: register(EmailSelectField),
    EMOTION_SELECT: register(EmotionSelectField),
    SELECT: register(SelectField),
    TEXTAREA: register(TextAreaField),
    TIME_RECORD_WIDGET: register(RecordTimeComponent),
    DATETIME_PICKER: register(DateTimePicker),
    TIME_SELECT: register(TimeSelect),
    TIME_SLOT_RECORD: register(TimeSlotRecord),
    ADDRESS_SEARCH_GROUP: register(AddressSearchGroup, { needsFormData: true, needsSetFormData: true }),
    GROUP: register(GroupComponent),
    ADMIN_USER_TABLE: register(AdminUserTable),
    AI_CHAT: register(AIChatComponent),
    AI_CHAT_V2: register(AIChatComponentV2),
    AI_INTERVIEW: register(AIInterviewComponent),
    CHECKBOX: register(CheckboxField),
    THEME_EDITOR: register(ThemeSettingsEditor),
    STAT_CARD: register(StatCard),
    CHART: register(Chart),
    GALLERY_GRID: register(GalleryGrid),
    HISTORY_LIST: register(HistoryList),
};

export const componentMap: Record<string, React.FC<any>> = Object.fromEntries(
    Object.entries(componentRegistry).map(([type, entry]) => [type, entry.component])
) as Record<string, React.FC<any>>;

// 도메인 플러그인이 컴포넌트 타입을 런타임 주입한다(코어 하드코딩 제거).
// 렌더 이전(bootstrap import 시점)에 호출되어 componentRegistry에 반영된다.
export function registerComponent(
    type: string,
    Component: React.FC<any>,
    traits: Omit<ComponentRegistryEntry, "component"> = {}
): void {
    const entry = register(Component, traits);
    componentRegistry[type] = entry;
    componentMap[type] = entry.component;
}
