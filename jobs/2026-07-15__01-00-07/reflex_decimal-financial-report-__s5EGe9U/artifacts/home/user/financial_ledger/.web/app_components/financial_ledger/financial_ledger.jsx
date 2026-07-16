
import {Fragment,memo,useCallback,useContext,useEffect} from "react"
import {ReflexEvent,applyEventActions,isNotNullOrUndefined,isTrue} from "$/utils/state"
import {StateContexts,addEvents} from "$/utils/context"
import {Button as RadixThemesButton,Table as RadixThemesTable,Text as RadixThemesText,TextField as RadixThemesTextField} from "@radix-ui/themes"
import {jsx} from "@emotion/react"
import DebounceInput from "react-debounce-input"








export const Foreach_comp_87f178cece767b8f29acb469d0f5714d_b9c15ae3 = memo(({children}) => {
    const reflex___state____state__financial_ledger___financial_ledger____state = useContext(StateContexts.reflex___state____state__financial_ledger___financial_ledger____state)



    return(
        Array.prototype.map.call(reflex___state____state__financial_ledger___financial_ledger____state.ledger_rows_rx_state_ ?? [],((row_rx_state_,index_46a960437c994afcabcccffd1d95aeaf)=>(jsx(RadixThemesTable.Row,{key:index_46a960437c994afcabcccffd1d95aeaf},jsx(RadixThemesTable.Cell,{},row_rx_state_?.["description"]),jsx(RadixThemesTable.Cell,{},row_rx_state_?.["amount"]),jsx(RadixThemesTable.Cell,{},row_rx_state_?.["timestamp"]),jsx(RadixThemesTable.Cell,{},row_rx_state_?.["balance"])))))
    )
});

export const Bare_comp_a1993324ae6d3caeeb52ccb3858a2489_b9c15ae3 = memo(({children}) => {
    const reflex___state____state__financial_ledger___financial_ledger____state = useContext(StateContexts.reflex___state____state__financial_ledger___financial_ledger____state)



    return(
        reflex___state____state__financial_ledger___financial_ledger____state.total_credits_rx_state_
    )
});

export const Bare_comp_e31eac9d6197608f8f385407e01b751d_b9c15ae3 = memo(({children}) => {
    const reflex___state____state__financial_ledger___financial_ledger____state = useContext(StateContexts.reflex___state____state__financial_ledger___financial_ledger____state)



    return(
        reflex___state____state__financial_ledger___financial_ledger____state.total_debits_rx_state_
    )
});

export const Bare_comp_0e9a011946e66cdef0f12a500a30ad15_b9c15ae3 = memo(({children}) => {
    const reflex___state____state__financial_ledger___financial_ledger____state = useContext(StateContexts.reflex___state____state__financial_ledger___financial_ledger____state)



    return(
        reflex___state____state__financial_ledger___financial_ledger____state.net_balance_rx_state_
    )
});

export const Text_text_acc04146e63b1aac91955fbd17d3cc22_b9c15ae3 = memo(({children}) => {
    const reflex___state____state__financial_ledger___financial_ledger____state = useContext(StateContexts.reflex___state____state__financial_ledger___financial_ledger____state)



    return(
        jsx(RadixThemesText,{as:"p",css:({ ["color"] : (reflex___state____state__financial_ledger___financial_ledger____state.is_net_balance_positive_rx_state_ ? "green" : "red"), ["fontWeight"] : "bold" })},children)
    )
});

export const Debounceinput_debounceinput_f16e992ed7b09e3a57d9035c53ad7fa9_b9c15ae3 = memo(({children}) => {
    const on_change_d8162db997a92cd54df949ce9acc64d2 = useCallback(((_e) => (addEvents([(ReflexEvent("reflex___state____state.financial_ledger___financial_ledger____state.set_new_description", ({ ["val"] : _e?.["target"]?.["value"] }), ({  })))], [_e], ({  })))), [addEvents, ReflexEvent])
const reflex___state____state__financial_ledger___financial_ledger____state = useContext(StateContexts.reflex___state____state__financial_ledger___financial_ledger____state)



    return(
        jsx(DebounceInput,{css:({ ["flex"] : "1" }),debounceTimeout:300,element:RadixThemesTextField.Root,onChange:on_change_d8162db997a92cd54df949ce9acc64d2,placeholder:"Description (e.g., Coffee)",value:(isNotNullOrUndefined(reflex___state____state__financial_ledger___financial_ledger____state.new_description_rx_state_) ? reflex___state____state__financial_ledger___financial_ledger____state.new_description_rx_state_ : "")},)
    )
});

export const Debounceinput_debounceinput_d87035adec230a65efff5b59b0771e92_b9c15ae3 = memo(({children}) => {
    const on_change_b4d9fb7062237bb891e2aa817afe011f = useCallback(((_e) => (addEvents([(ReflexEvent("reflex___state____state.financial_ledger___financial_ledger____state.set_new_amount", ({ ["val"] : _e?.["target"]?.["value"] }), ({  })))], [_e], ({  })))), [addEvents, ReflexEvent])
const reflex___state____state__financial_ledger___financial_ledger____state = useContext(StateContexts.reflex___state____state__financial_ledger___financial_ledger____state)



    return(
        jsx(DebounceInput,{css:({ ["width"] : "200px" }),debounceTimeout:300,element:RadixThemesTextField.Root,onChange:on_change_b4d9fb7062237bb891e2aa817afe011f,placeholder:"Amount (e.g., -4.50 or 15.00)",value:(isNotNullOrUndefined(reflex___state____state__financial_ledger___financial_ledger____state.new_amount_rx_state_) ? reflex___state____state__financial_ledger___financial_ledger____state.new_amount_rx_state_ : "")},)
    )
});

export const Button_button_0ee1f714178b7ff305079a2b9522ff7f_b9c15ae3 = memo(({children}) => {
    const on_click_b478f045bac6687fc0868102375ebfd9 = useCallback(((_e) => (addEvents([(ReflexEvent("reflex___state____state.financial_ledger___financial_ledger____state.add_entry", ({  }), ({  })))], [_e], ({  })))), [addEvents, ReflexEvent])



    return(
        jsx(RadixThemesButton,{onClick:on_click_b478f045bac6687fc0868102375ebfd9},children)
    )
});
