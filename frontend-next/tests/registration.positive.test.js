import { validatePassword, validateRegistrationFields } from '@/utils/registrationValidation';

describe('Registration Positive Tests', () => {
  describe('validatePassword', () => {
    test('strong password passes all requirement checks', () => {
      const result = validatePassword('StrongP@ss1');
      expect(result.isValid).toBe(true);
      expect(result.minLength).toBe(true);
      expect(result.hasUpperCase).toBe(true);
      expect(result.hasLowerCase).toBe(true);
      expect(result.hasNumber).toBe(true);
      expect(result.hasSpecialChar).toBe(true);
    });

    test('password with exactly 8 characters meeting all rules passes', () => {
      const result = validatePassword('Abcde1!x');
      expect(result.isValid).toBe(true);
    });

    test('long complex password passes', () => {
      const result = validatePassword('MyV3ryStr0ng!Password#2024');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateRegistrationFields', () => {
    test('valid email passes validation', () => {
      const result = validateRegistrationFields({
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'StrongP@ss1',
        confirmPassword: 'StrongP@ss1',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('all fields filled correctly returns isValid true', () => {
      const result = validateRegistrationFields({
        fullName: 'Jane Smith',
        email: 'jane.smith@university.edu',
        password: 'C0mplex!ty',
        confirmPassword: 'C0mplex!ty',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('email with subdomain passes', () => {
      const result = validateRegistrationFields({
        fullName: 'Test User',
        email: 'user@mail.college.edu',
        password: 'Test1ng!Pass',
        confirmPassword: 'Test1ng!Pass',
      });
      expect(result.isValid).toBe(true);
    });

    test('name with spaces and hyphens passes', () => {
      const result = validateRegistrationFields({
        fullName: 'Mary-Jane O\'Brien',
        email: 'mj@test.com',
        password: 'Str0ng!Pass',
        confirmPassword: 'Str0ng!Pass',
      });
      expect(result.isValid).toBe(true);
    });
  });
});
