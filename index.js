import React, { Component } from 'react'
import { View, TextInput, TouchableWithoutFeedback, Clipboard, Keyboard, Platform, I18nManager, } from 'react-native'
import PropTypes from 'prop-types'
import styles from './styles'
import { isAutoFillSupported } from './helpers/device'

export default class OTPInputView extends Component {
    static propTypes = {
        pinCount: PropTypes.number,
        codeInputFieldStyle: PropTypes.object,
        codeInputHighlightStyle: PropTypes.object,
        onCodeFilled: PropTypes.func,
        onCodeChanged: PropTypes.func,
        autoFocusOnLoad: PropTypes.bool,
        code: PropTypes.string,
        secureTextEntry: PropTypes.bool,
        keyboardType: PropTypes.string,
        clearInputs: PropTypes.bool,
        placeholderCharacter: PropTypes.string,
        placeholderTextColor: PropTypes.string,
        style: PropTypes.object,
        selectionColor: PropTypes.string,
    }

    static defaultProps = {
        pinCount: 6,
        codeInputFieldStyle: null,
        codeInputHighlightStyle: null,
        onCodeFilled: null,
        autoFocusOnLoad: true,
        secureTextEntry: false,
        keyboardType: "number-pad",
        clearInputs: false,
        placeholderCharacter: "",
        placeholderTextColor: null,
        style: null,
        selectionColor: '#000',
    }

    fields = []

    constructor(props) {
        super(props)
        const { code } = props
        this.state = {
            digits: (code === undefined ? [] : code.split("")),
            selectedIndex: 0,
        }
    }

    componentWillReceiveProps(nextProps) {
        const { code } = this.props
        if (nextProps.code !== code) {
            this.setState({ digits: (nextProps.code === undefined ? [] : nextProps.code.split("")) })
        }
    }

    componentDidMount() {
        this.copyCodeFromClipBoardOnAndroid()
        this.bringUpKeyBoardIfNeeded()
        this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.handleKeyboardDidHide)
    }

    componentWillUnmount() {
        if (this._timer) {
            clearInterval(this._timer)
        }
        this.keyboardDidHideListener.remove()
    }

    copyCodeFromClipBoardOnAndroid = () => {
        if (Platform.OS === "android") {
            this.checkPinCodeFromClipBoard()
            this._timer = setInterval(() => {
                this.checkPinCodeFromClipBoard()
            }, 400)
        }
    }

    bringUpKeyBoardIfNeeded = () => {
        const { autoFocusOnLoad, pinCount } = this.props
        const digits = this.getDigits()
        const focusIndex = digits.length ? digits.length - 1 : 0
        if (focusIndex < pinCount && autoFocusOnLoad) {
            this.focusField(focusIndex)
        }
    }

    getDigits = () => {
        const { digits: innerDigits } = this.state
        const { code } = this.props
        return code === undefined ? innerDigits : code.split("")
    }

    handleKeyboardDidHide = () => {
        this.blurAllFields()
    }

    notifyCodeChanged = () => {
        const { digits } = this.state
        const code = digits.join("")
        const { onCodeChanged } = this.props
        if (onCodeChanged) {
            onCodeChanged(code)
        }
    }

    checkPinCodeFromClipBoard = () => {
        const { pinCount, onCodeFilled } = this.props
        const regexp = new RegExp(`^\\d{${pinCount}}$`)
        Clipboard.getString().then(code => {
            if (this.hasCheckedClipBoard && regexp.test(code) && (this.clipBoardCode !== code)) {
                this.setState({
                    digits: code.split(""),
                }, () => {
                    this.blurAllFields()
                    this.notifyCodeChanged()
                    onCodeFilled && onCodeFilled(code)
                })
                Clipboard.setString('');
            }
            this.clipBoardCode = code
            this.hasCheckedClipBoard = true
        }).catch(e => {
        })
    }

    handleChangeText = (index, text) => {
        const { onCodeFilled, pinCount } = this.props
        const digits = this.getDigits()
        let newdigits = digits.slice()
        const oldTextLength = newdigits[index] ? newdigits[index].length : 0
        const newTextLength = text.length
        if (newTextLength - oldTextLength === pinCount) { // user pasted text in.
            newdigits = text.split("").slice(oldTextLength, newTextLength)
            this.setState({ digits: newdigits }, this.notifyCodeChanged)
        } else {
            if (text.length === 0) {
                if (newdigits.length > 0) {
                    newdigits = newdigits.slice(0, newdigits.length - 1)
                }
            } else {
                text.split("").forEach((value) => {
                  if(index < pinCount) {
                    newdigits[index] = value;
                    index += 1;
                  }
                })
                index -= 1
            }
            this.setState({ digits: newdigits }, this.notifyCodeChanged)
        }

        let result = newdigits.join("")
        if (result.length >= pinCount) {
            onCodeFilled && onCodeFilled(result)
            this.focusField(pinCount - 1)
            this.blurAllFields()
        } else {
            if (text.length > 0 && index < pinCount - 1) {
                this.focusField(index + 1)
            }
        }
    }

    handleKeyPressTextInput = (index, key) => {
        const digits = this.getDigits()
        if (key === 'Backspace') {
            if (!digits[index] && index > 0) {
                this.handleChangeText(index - 1, '')
                this.focusField(index - 1)
            }
        }
    }

    focusField = (index) => {
        if (index < this.fields.length) {
            this.fields[index].focus()
            this.setState({
                selectedIndex: index
            })
        }
    }

    blurAllFields = () => {
        this.fields.forEach(field => field.blur())
        this.setState({
            selectedIndex: -1,
        })
    }


    clearAllFields = () => {
        const { clearInputs, code } = this.props;
        if (clearInputs && code === "") {
            this.setState({ digits: [], selectedIndex: 0 })
        }
    }

    renderOneInputField = (_, index) => {
        const { codeInputFieldStyle, codeInputHighlightStyle, secureTextEntry, keyboardType, selectionColor } = this.props
        const { defaultTextFieldStyle } = styles
        const { digits } = this.state
        const { clearInputs, placeholderCharacter, placeholderTextColor } = this.props
        const { color: defaultPlaceholderTextColor } = { ...defaultTextFieldStyle, ...codeInputFieldStyle }
        let isInputSelected = false;
        if (this.fields[index]) {
            isInputSelected = this.fields[index].isFocused();
        }
        return (
            <View pointerEvents="none" key={index + "view"} testID="inputSlotView">
                <TextInput
                    testID="textInput"
                    underlineColorAndroid='rgba(0,0,0,0)'
                    style={[
                        defaultTextFieldStyle,
                        codeInputFieldStyle,
                        isInputSelected ? codeInputHighlightStyle : ''
                    ]}
                    ref={ref => { this.fields[index] = ref }}
                    onChangeText={text => {
                        this.handleChangeText(index, text)
                    }}
                    onKeyPress={({ nativeEvent: { key } }) => { this.handleKeyPressTextInput(index, key) }}
                    value={ !clearInputs ? digits[index]: "" }
                    keyboardType={keyboardType}
                    textContentType={isAutoFillSupported ? "oneTimeCode" : "none"}
                    key={index}
                    selectionColor={selectionColor}
                    secureTextEntry={secureTextEntry}
                    placeholder={placeholderCharacter}
                    placeholderTextColor={placeholderTextColor || defaultPlaceholderTextColor}
                />
            </View>
        )
    }

    renderTextFields = () => {
        const { pinCount } = this.props
        const array = new Array(pinCount).fill(0)
        return array.map(this.renderOneInputField)
    }

    render() {
        const { pinCount, style, clearInputs } = this.props
        const digits = this.getDigits()
        return (
            <View
                testID="OTPInputView"
                style={style}
            >
                <TouchableWithoutFeedback
                    style={{ width: '100%', height: '100%' }}
                    onPress={() => {
                        if (!clearInputs) {
                            let filledPinCount = digits.filter((digit) => { return (digit !== null && digit !== undefined) }).length
                            this.focusField(Math.min(filledPinCount, pinCount - 1))
                        } else {
                            this.clearAllFields();
                            this.focusField(0)
                        }
                    }}
                >
                    <View
                        style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: '100%' }}
                    >
                        {this.renderTextFields()}
                    </View>
                </TouchableWithoutFeedback>
            </View>
        );
    }
}
