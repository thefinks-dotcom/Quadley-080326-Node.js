"""Password policy validation (OWASP A07 Compliance)"""
import re
from typing import Tuple, List

class PasswordPolicy:
    """
    Strong password policy based on NIST SP 800-63B guidelines.
    Updated for OWASP A07:2021 - Identification and Authentication Failures
    """
    MIN_LENGTH = 8  # Minimum 8 characters with complexity requirements
    MAX_LENGTH = 128
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGIT = True
    REQUIRE_SPECIAL = True
    SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?~`'\"\\/"
    
    # Expanded common passwords to block (top passwords from breach databases)
    COMMON_PASSWORDS = {
        'password', 'password123', 'password1234', '123456', '12345678',
        '123456789', '1234567890', 'qwerty', 'qwerty123', 'qwertyuiop',
        'abc123', 'abc12345', 'monkey', 'monkey123', 'letmein', 'letmein123',
        'dragon', 'dragon123', 'baseball', 'football', 'soccer', 'hockey',
        'iloveyou', 'iloveyou1', 'trustno1', 'sunshine', 'sunshine1',
        'princess', 'princess1', 'welcome', 'welcome1', 'welcome123',
        'admin', 'admin123', 'admin1234', 'administrator', 'root', 'toor',
        'pass', 'pass123', 'test', 'test123', 'testing', 'testing123',
        'guest', 'guest123', 'master', 'master123', 'login', 'login123',
        'hello', 'hello123', 'shadow', 'shadow123', 'password1', 'passw0rd',
        'changeme', 'changeme123', 'default', 'default123', '111111', '000000',
        'michael', 'jennifer', 'jordan', 'hunter', 'ranger', 'buster',
        'soccer123', 'batman', 'superman', 'starwars', 'whatever',
        'computer', 'internet', 'secret', 'secret123', 'access', 'access123',
        'mustang', 'corvette', 'ferrari', 'porsche', 'mercedes',
        'summer', 'winter', 'spring', 'autumn', 'january', 'december',
        'monday', 'friday', 'sunday', 'weekend', 'holiday',
        'qazwsx', 'zxcvbn', 'asdfgh', '1qaz2wsx', 'qweasd',
    }
    
    # Patterns to detect (keyboard walks, repeated chars, sequential)
    WEAK_PATTERNS = [
        r'(.)\1{3,}',  # Same char repeated 4+ times
        r'(012|123|234|345|456|567|678|789|890){2,}',  # Sequential numbers
        r'(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz){2,}',  # Sequential letters
    ]

    @classmethod
    def validate(cls, password: str, email: str = None) -> Tuple[bool, List[str]]:
        """
        Validate password against policy.
        Returns (is_valid, list_of_errors)
        """
        errors = []
        
        if len(password) < cls.MIN_LENGTH:
            errors.append(f"Password must be at least {cls.MIN_LENGTH} characters")
        
        if len(password) > cls.MAX_LENGTH:
            errors.append(f"Password must be less than {cls.MAX_LENGTH} characters")
        
        if cls.REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter")
        
        if cls.REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter")
        
        if cls.REQUIRE_DIGIT and not re.search(r'\d', password):
            errors.append("Password must contain at least one number")
        
        if cls.REQUIRE_SPECIAL and not re.search(f'[{re.escape(cls.SPECIAL_CHARS)}]', password):
            errors.append("Password must contain at least one special character (!@#$%^&*)")
        
        # Check against common passwords
        if password.lower() in cls.COMMON_PASSWORDS:
            errors.append("Password is too common. Please choose a stronger password")
        
        # Check weak patterns
        for pattern in cls.WEAK_PATTERNS:
            if re.search(pattern, password.lower()):
                errors.append("Password contains a weak pattern (repeated or sequential characters)")
                break
        
        # Check if password contains email/username
        if email:
            email_local = email.split('@')[0].lower()
            if len(email_local) > 3 and email_local in password.lower():
                errors.append("Password cannot contain your email address")
            
            # Also check domain part
            if '@' in email:
                email_domain = email.split('@')[1].split('.')[0].lower()
                if len(email_domain) > 3 and email_domain in password.lower():
                    errors.append("Password cannot contain parts of your email domain")
        
        return len(errors) == 0, errors

    @classmethod
    def get_requirements_text(cls) -> str:
        """Return human-readable password requirements"""
        reqs = [f"At least {cls.MIN_LENGTH} characters"]
        if cls.REQUIRE_UPPERCASE:
            reqs.append("one uppercase letter")
        if cls.REQUIRE_LOWERCASE:
            reqs.append("one lowercase letter")
        if cls.REQUIRE_DIGIT:
            reqs.append("one number")
        if cls.REQUIRE_SPECIAL:
            reqs.append("one special character")
        return ", ".join(reqs)
    
    @classmethod
    def get_strength_score(cls, password: str) -> int:
        """
        Calculate password strength score (0-100).
        Useful for password strength meters.
        """
        score = 0
        
        # Length scoring (up to 40 points)
        length = len(password)
        if length >= 8:
            score += 10
        if length >= 12:
            score += 10
        if length >= 16:
            score += 10
        if length >= 20:
            score += 10
        
        # Character variety (up to 40 points)
        if re.search(r'[a-z]', password):
            score += 10
        if re.search(r'[A-Z]', password):
            score += 10
        if re.search(r'\d', password):
            score += 10
        if re.search(f'[{re.escape(cls.SPECIAL_CHARS)}]', password):
            score += 10
        
        # Bonus for mixed case and numbers (up to 20 points)
        if re.search(r'[a-z].*[A-Z]|[A-Z].*[a-z]', password):
            score += 10
        if re.search(r'\d.*\d', password):
            score += 5
        if re.search(f'[{re.escape(cls.SPECIAL_CHARS)}].*[{re.escape(cls.SPECIAL_CHARS)}]', password):
            score += 5
        
        # Penalties
        if password.lower() in cls.COMMON_PASSWORDS:
            score = max(0, score - 50)
        
        for pattern in cls.WEAK_PATTERNS:
            if re.search(pattern, password.lower()):
                score = max(0, score - 20)
                break
        
        return min(100, score)
