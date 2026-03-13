import { validatePassword, validateRegistrationFields } from '@/utils/registrationValidation';

describe('Registration Negative Tests', () => {
  describe('validatePassword', () => {
    test('password under 8 characters fails', () => {
      const result = validatePassword('Sh0rt!');
      expect(result.isValid).toBe(false);
      expect(result.minLength).toBe(false);
    });

    test('password missing uppercase fails', () => {
      const result = validatePassword('nouppercase1!');
      expect(result.isValid).toBe(false);
      expect(result.hasUpperCase).toBe(false);
    });

    test('password missing lowercase fails', () => {
      const result = validatePassword('NOLOWERCASE1!');
      expect(result.isValid).toBe(false);
      expect(result.hasLowerCase).toBe(false);
    });

    test('password missing number fails', () => {
      const result = validatePassword('NoNumber!here');
      expect(result.isValid).toBe(false);
      expect(result.hasNumber).toBe(false);
    });

    test('password missing special character fails', () => {
      const result = validatePassword('NoSpecial1char');
      expect(result.isValid).toBe(false);
      expect(result.hasSpecialChar).toBe(false);
    });

    test('empty password fails all checks', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.minLength).toBe(false);
      expect(result.hasUpperCase).toBe(false);
      expect(result.hasLowerCase).toBe(false);
      expect(result.hasNumber).toBe(false);
      expect(result.hasSpecialChar).toBe(false);
    });
  });

  describe('validateRegistrationFields', () => {
    test('empty email returns an error', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: '',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    test('malformed email missing @ fails', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'johndoe.com',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    test('malformed email missing domain fails', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    test('empty password fails', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: '',
        confirmPassword: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password is required');
    });

    test('short password returns specific error', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'Ab1!',
        confirmPassword: 'Ab1!',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    test('mismatched passwords fails', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'StrongP@ss1',
        confirmPassword: 'DifferentP@ss1',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Passwords do not match');
    });

    test('empty fullName returns an error', () => {
      const result = validateRegistrationFields({
        fullName: '',
        email: 'john@example.com',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Full name is required');
    });

    test('whitespace-only fullName returns an error', () => {
      const result = validateRegistrationFields({
        fullName: '   ',
        email: 'john@example.com',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Full name is required');
    });

    test('password missing uppercase in registration returns error', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'nouppercase1!',
        confirmPassword: 'nouppercase1!',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain an uppercase letter');
    });

    test('password missing number in registration returns error', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'NoNumber!here',
        confirmPassword: 'NoNumber!here',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain a number');
    });

    test('password missing lowercase in registration returns error', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'NOLOWERCASE1!',
        confirmPassword: 'NOLOWERCASE1!',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain a lowercase letter');
    });

    test('password missing special char in registration returns error', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'NoSpecial1char',
        confirmPassword: 'NoSpecial1char',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain a special character');
    });

    test('missing confirmPassword returns error', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'StrongP@ss1',
        confirmPassword: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please confirm your password');
    });

    test('whitespace-only email returns error', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: '   ',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });
  });
});
