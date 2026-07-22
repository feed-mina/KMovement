import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmailSelectLeaf, InputLeaf, PasswordLeaf } from '../formLeaves';

// Shaped like the V22 seed row for LOGIN_PAGE.user_email_domain, which marks the
// field readonly. EMAIL_SELECT must ignore that, or the domain is unselectable
// and login is unreachable.
const DOMAIN_META = {
  component_id: 'user_email_domain',
  component_type: 'EMAIL_SELECT',
  label_text: '@',
  is_readonly: true,
};

describe('EmailSelectLeaf', () => {
  it('selects a domain even though the seed marks the field readonly', () => {
    const onChange = jest.fn();
    render(<EmailSelectLeaf id="user_email_domain" meta={DOMAIN_META} formData={{}} onChange={onChange} />);

    fireEvent.press(screen.getByText('naver.com'));

    expect(onChange).toHaveBeenCalledWith('user_email_domain', 'naver.com');
  });

  it('ignores a readonly flag serialized as the string "true"', () => {
    const onChange = jest.fn();
    render(
      <EmailSelectLeaf
        id="user_email_domain"
        meta={{ ...DOMAIN_META, is_readonly: 'true' }}
        formData={{}}
        onChange={onChange}
      />,
    );

    fireEvent.press(screen.getByText('gmail.com'));

    expect(onChange).toHaveBeenCalledWith('user_email_domain', 'gmail.com');
  });

  it('reveals a text field for a custom domain and reports what is typed', () => {
    const onChange = jest.fn();
    render(<EmailSelectLeaf id="user_email_domain" meta={DOMAIN_META} formData={{}} onChange={onChange} />);

    expect(screen.queryByPlaceholderText('예: kakao.com')).toBeNull();

    fireEvent.press(screen.getByText('직접 입력'));
    const input = screen.getByPlaceholderText('예: kakao.com');
    fireEvent.changeText(input, 'kakao.com');

    expect(input.props.editable).not.toBe(false);
    expect(onChange).toHaveBeenCalledWith('user_email_domain', 'kakao.com');
  });

  it('offers every seeded domain option', () => {
    render(<EmailSelectLeaf id="user_email_domain" meta={DOMAIN_META} formData={{}} onChange={jest.fn()} />);

    for (const domain of ['naver.com', 'gmail.com', 'nate.com', 'hanmail.net']) {
      expect(screen.getByText(domain)).toBeTruthy();
    }
  });
});

// The readonly fix was deliberately scoped to EMAIL_SELECT; is_readonly is not
// legacy and the other leaves must keep honouring it.
describe('is_readonly stays enforced outside EMAIL_SELECT', () => {
  it('InputLeaf blocks edits when readonly', () => {
    const onChange = jest.fn();
    render(
      <InputLeaf
        id="user_email"
        meta={{ component_id: 'user_email', placeholder: '아이디 입력', is_readonly: true }}
        formData={{}}
        onChange={onChange}
      />,
    );

    const input = screen.getByPlaceholderText('아이디 입력');
    expect(input.props.editable).toBe(false);

    fireEvent.changeText(input, 'someone');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('InputLeaf accepts edits when not readonly', () => {
    const onChange = jest.fn();
    render(
      <InputLeaf
        id="user_email"
        meta={{ component_id: 'user_email', placeholder: '아이디 입력', is_readonly: false }}
        formData={{}}
        onChange={onChange}
      />,
    );

    fireEvent.changeText(screen.getByPlaceholderText('아이디 입력'), 'someone');
    expect(onChange).toHaveBeenCalledWith('user_email', 'someone');
  });

  it('PasswordLeaf blocks edits when readonly', () => {
    const onChange = jest.fn();
    render(
      <PasswordLeaf
        id="user_pw"
        meta={{ component_id: 'user_pw', placeholder: '비밀번호를 입력하세요', is_readonly: true }}
        formData={{}}
        onChange={onChange}
      />,
    );

    const input = screen.getByPlaceholderText('비밀번호를 입력하세요');
    expect(input.props.editable).toBe(false);

    fireEvent.changeText(input, 'secret');
    expect(onChange).not.toHaveBeenCalled();
  });
});
