export function validatePassword(password) {
  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  return {
    isValid: minLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar,
    minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumber,
    hasSpecialChar,
  };
}

export function validateRegistrationFields({ fullName, email, password, confirmPassword }) {
  const errors = [];

  if (!fullName || !fullName.trim()) {
    errors.push('Full name is required');
  }

  if (!email || !email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }

  if (!password) {
    errors.push('Password is required');
  } else {
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.minLength) {
      errors.push('Password must be at least 8 characters');
    }
    if (!passwordValidation.hasUpperCase) {
      errors.push('Password must contain an uppercase letter');
    }
    if (!passwordValidation.hasLowerCase) {
      errors.push('Password must contain a lowercase letter');
    }
    if (!passwordValidation.hasNumber) {
      errors.push('Password must contain a number');
    }
    if (!passwordValidation.hasSpecialChar) {
      errors.push('Password must contain a special character');
    }
  }

  if (password && confirmPassword && password !== confirmPassword) {
    errors.push('Passwords do not match');
  } else if (password && !confirmPassword) {
    errors.push('Please confirm your password');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
