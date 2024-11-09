document.getElementById('contact-form').addEventListener('submit', function (e) {
  e.preventDefault();

  let name = document.getElementById('name').value;
  let email = document.getElementById('email').value;
  let message = document.getElementById('message').value;

  if (!name || !email || !message) {
      alert('Please fill in all fields.');
      return;
  }

  alert(`Message Sent! Thank you, ${name}.`);
  // Optionally: Here you could also integrate with email services like emailjs or similar.
  e.target.reset(); // Reset the form after submission
});
